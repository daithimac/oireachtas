import Foundation

// Session-scoped cache — mirrors the web app's responseCache Map.
// Evicts failed requests so retries can succeed.
actor OireachtasAPI {
    static let shared = OireachtasAPI()

    private let base = URL(string: "https://api.oireachtas.ie/v1/")!

    // NSCache auto-evicts under memory pressure and is thread-safe — safer than
    // the unbounded [URL: Data] used previously in long-running sessions.
    private let cache: NSCache<NSURL, NSData> = {
        let c = NSCache<NSURL, NSData>()
        c.countLimit = 200
        c.totalCostLimit = 20 * 1024 * 1024  // 20MB of JSON
        return c
    }()

    // MARK: - Generic fetch

    private func fetch<T: Decodable>(_ path: String, params: [String: String] = [:]) async throws -> T {
        var comps = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: true)!
        comps.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = comps.url else { throw APIError.badURL }

        if let cached = cache.object(forKey: url as NSURL) {
            return try JSONDecoder().decode(T.self, from: cached as Data)
        }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        cache.setObject(data as NSData, forKey: url as NSURL, cost: data.count)
        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Constituencies

    func getConstituencies(chamber: String = "dail", houseNo: Int = currentDailNo) async throws -> [Constituency] {
        let result: APIResult<ConstituencyItem> = try await fetch("constituencies", params: [
            "chamber": chamber, "house_no": "\(houseNo)", "limit": "200",
        ])
        return result.results
            .map { Constituency(id: $0.constituency.code, name: $0.constituency.name, uri: $0.constituency.uri) }
            .sorted { $0.name < $1.name }
    }

    // MARK: - Members

    func getMembers(
        chamber: String = "dail", houseNo: Int = currentDailNo,
        constCode: String? = nil, memberUri: String? = nil
    ) async throws -> [Member] {
        var params: [String: String] = [
            "chamber": chamber, "house_no": "\(houseNo)", "limit": "500",
        ]
        if let c = constCode { params["const_code"] = c }
        if let m = memberUri  { params["member_id"] = m }
        let result: APIResult<MemberItem> = try await fetch("members", params: params)
        return result.results.compactMap { normalizeMember($0.member, chamber: chamber, houseNo: houseNo) }
    }

    // MARK: - Debates

    func getDebates(
        memberUri: String? = nil,
        chamberId: String? = nil,
        chamberType: String? = nil,
        dateStart: String? = nil,
        dateEnd: String? = nil,
        limit: Int = 20,
        skip: Int = 0
    ) async throws -> (debates: [Debate], total: Int) {
        var params: [String: String] = ["limit": "\(limit)", "skip": "\(skip)"]
        if let m = memberUri  { params["member_id"] = m }
        if let c = chamberId  { params["chamber_id"] = c }
        if let t = chamberType { params["chamber_type"] = t }
        if let s = dateStart  { params["date_start"] = s }
        if let e = dateEnd    { params["date_end"] = e }
        let result: APIResult<DebateItem> = try await fetch("debates", params: params)
        let total = result.head?.counts?.totalCount ?? result.results.count
        return (result.results.compactMap { normalizeDebate($0.debate) }, total)
    }

    // MARK: - Divisions

    func getDivisions(
        memberUri: String? = nil,
        chamberId: String? = nil,
        limit: Int = 50,
        skip: Int = 0
    ) async throws -> [Division] {
        var params: [String: String] = ["limit": "\(limit)", "skip": "\(skip)"]
        if let m = memberUri { params["member_id"] = m }
        if let c = chamberId { params["chamber_id"] = c }
        let result: APIResult<DivisionItem> = try await fetch("divisions", params: params)
        return result.results.compactMap { normalizeDivision($0.division) }
    }

    // MARK: - Questions

    func getQuestions(
        memberUri: String,
        qtype: String = "oral,written",
        limit: Int = 20,
        skip: Int = 0
    ) async throws -> [Question] {
        let result: APIResult<QuestionItem> = try await fetch("questions", params: [
            "member_id": memberUri, "qtype": qtype,
            "limit": "\(limit)", "skip": "\(skip)",
        ])
        return result.results.compactMap { normalizeQuestion($0.question) }
    }

    // MARK: - Member activity counts (Overview tab)
    // Fans out to 4 endpoints with limit=1 to read totals from head.counts —
    // much cheaper than loading the full lists just to count them.

    func memberCounts(memberUri: String) async throws -> (debates: Int, votes: Int, questions: Int, bills: Int) {
        async let d: APIResult<DebateItem> = fetch("debates", params: ["member_id": memberUri, "limit": "1"])
        async let v: APIResult<DivisionItem> = fetch("divisions", params: ["member_id": memberUri, "limit": "1"])
        async let q: APIResult<QuestionItem> = fetch("questions", params: ["member_id": memberUri, "qtype": "oral,written", "limit": "1"])
        async let b: APIResult<LegislationItem> = fetch("legislation", params: ["member_id": memberUri, "limit": "1"])

        let (dr, vr, qr, br) = try await (d, v, q, b)
        return (
            dr.head?.counts?.totalCount ?? dr.results.count,
            vr.head?.counts?.totalCount ?? vr.results.count,
            qr.head?.counts?.totalCount ?? qr.results.count,
            br.head?.counts?.totalCount ?? br.results.count
        )
    }

    // MARK: - Legislation

    func getLegislation(
        memberUri: String? = nil,
        chamberId: String? = nil,
        limit: Int = 20,
        skip: Int = 0
    ) async throws -> [Bill] {
        var params: [String: String] = ["limit": "\(limit)", "skip": "\(skip)"]
        if let m = memberUri { params["member_id"] = m }
        if let c = chamberId { params["chamber_id"] = c }
        let result: APIResult<LegislationItem> = try await fetch("legislation", params: params)
        return result.results.compactMap { normalizeBill($0.bill) }
    }

    // MARK: - Normalisation

    private func normalizeMember(_ raw: MemberRaw, chamber: String, houseNo: Int) -> Member? {
        // Find the membership for this specific house
        let ms = raw.memberships?.compactMap(\.membership) ?? []
        let houseMembership = ms.first {
            $0.house?.houseCode == chamber && $0.house?.houseNo == "\(houseNo)"
        } ?? ms.first

        let party = extractParty(ms)
        let constituency = extractConstituency(ms)
        let offices = ms.flatMap { m in
            (m.offices ?? []).compactMap { w -> String? in
                guard w.office?.dateRange?.end == nil else { return nil }
                return w.office?.officeName?.showAs ?? w.office?.showAs
            }
        }
        let committees = (houseMembership?.committees ?? []).compactMap { c -> CommitteeMembership? in
            guard let name = c.committeeName?.first?.nameEn, !name.isEmpty else { return nil }
            guard c.memberDateRange?.end == nil else { return nil }
            return CommitteeMembership(name: name, uri: c.uri, role: "Member")
        }

        return Member(
            id: raw.memberCode,
            uri: raw.uri,
            memberCode: raw.memberCode,
            fullName: raw.fullName,
            firstName: raw.firstName,
            lastName: raw.lastName,
            party: party,
            constituency: constituency.name,
            constituencyCode: constituency.code,
            photoUrl: memberPhotoUrl(raw.uri),
            offices: offices,
            committees: committees
        )
    }

    private func extractParty(_ memberships: [MembershipRaw]) -> String {
        var activeParty = ""
        var activeStart = ""
        var endedParty = ""
        var endedDate = ""
        for m in memberships {
            for pw in m.parties ?? [] {
                guard let p = pw.party else { continue }
                let start = p.dateRange?.start ?? ""
                let end = p.dateRange?.end
                if end == nil {
                    if start >= activeStart { activeStart = start; activeParty = p.showAs ?? "" }
                } else if let e = end, e > endedDate {
                    endedDate = e; endedParty = p.showAs ?? ""
                }
            }
        }
        return activeParty.isEmpty ? (endedParty.isEmpty ? "Independent" : endedParty) : activeParty
    }

    private func extractConstituency(_ memberships: [MembershipRaw]) -> (name: String, code: String) {
        for m in memberships {
            for rw in m.represents ?? [] {
                guard let r = rw.represent else { continue }
                if r.representType == "constituency" || r.representType == "panel" {
                    return (r.showAs ?? "", r.representCode ?? "")
                }
            }
        }
        if let r = memberships.first?.represents?.first?.represent {
            return (r.showAs ?? "", r.representCode ?? "")
        }
        return ("", "")
    }

    private func normalizeDebate(_ raw: DebateRaw) -> Debate? {
        guard let date = raw.date else { return nil }
        let sections = (raw.debateSections ?? []).compactMap(\.debateSection)
        let title = sections.first?.showAs ?? raw.debateType?.capitalized ?? "Debate"
        let xmlUri = raw.formats?.xml?.uri ?? sections.first?.formats?.xml?.uri
        return Debate(
            id: raw.uri, uri: raw.uri, date: date, title: title,
            debateType: raw.debateType ?? "", chamber: "", xmlUri: xmlUri
        )
    }

    private func normalizeDivision(_ raw: DivisionRaw) -> Division? {
        guard let date = raw.date else { return nil }
        let title = raw.showAs ?? raw.subject?.showAs ?? "Vote"
        let voteLabel = raw.memberTally?.showAs?.lowercased() ?? ""
        let voteType: String
        if voteLabel.contains("tá") || voteLabel.contains("ta") { voteType = "ta" }
        else if voteLabel.contains("níl") || voteLabel.contains("nil") { voteType = "nil" }
        else { voteType = "ta" }  // default for global list (no member context)
        let outcome = raw.outcome?.lowercased().contains("ried") == true ? "Carried" : "Defeated"
        return Division(
            id: raw.uri, uri: raw.uri, date: date, title: title,
            voteType: voteType, outcome: outcome,
            tallyFor: raw.tallies?.taVotes?.tally ?? 0,
            tallyAgainst: raw.tallies?.nilVotes?.tally ?? 0
        )
    }

    private func normalizeQuestion(_ raw: QuestionRaw) -> Question? {
        guard let date = raw.date else { return nil }
        let text = raw.showAs ?? "Question \(raw.questionNumber.map(String.init) ?? "")"
        return Question(
            id: raw.uri, uri: raw.uri, date: date,
            questionType: raw.questionType ?? "written",
            questionText: text,
            department: raw.to?.showAs ?? "",
            xmlUri: raw.debateSection?.formats?.xml?.uri
        )
    }

    private func normalizeBill(_ raw: BillRaw) -> Bill? {
        let title = raw.shortTitleEn ?? "Bill"
        let rawStages = raw.stages ?? []
        let recentName = raw.mostRecentStage?.event?.showAs

        let stages: [BillStage] = rawStages.enumerated().compactMap { i, sw in
            guard let event = sw.event, let name = event.showAs else { return nil }
            let isDone = event.date != nil
            // A stage is "current" if it's the most recent stage and not yet done,
            // or if it matches mostRecentStage name and all subsequent stages are undone.
            let nextIsDone = i + 1 < rawStages.count ? rawStages[i + 1].event?.date != nil : false
            let isCurrent = isDone && !nextIsDone && name == recentName
            return BillStage(name: name, date: event.date, isDone: isDone, isCurrent: isCurrent)
        }

        let pdfUri = raw.versions?.first?.version.formats?.pdf?.uri
        return Bill(
            id: raw.uri, uri: raw.uri,
            billNo: raw.billNo ?? "", billYear: raw.billYear ?? "",
            title: title, longTitle: raw.longTitleEn,
            status: raw.status ?? "", originHouse: raw.originHouse?.showAs ?? "Dáil Éireann",
            sponsors: raw.sponsors?.compactMap { $0.sponsor?.by?.showAs } ?? [],
            stages: stages, pdfUri: pdfUri
        )
    }
}

// MARK: - Error types

enum APIError: LocalizedError {
    case badURL
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid URL"
        case .httpError(let code): return "Server returned \(code)"
        }
    }
}
