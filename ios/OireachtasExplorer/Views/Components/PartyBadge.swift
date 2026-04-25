import SwiftUI

struct PartyBadge: View {
    let party: String
    var small: Bool = false

    var body: some View {
        Text(partyShort(party))
            .font(.inter(size: small ? 9 : 10, weight: .bold))
            .tracking(0.2)
            .foregroundColor(.white)
            .padding(.horizontal, small ? 6 : 9)
            .padding(.vertical, small ? 2 : 3)
            .background(partyColor(party))
            .clipShape(Capsule())
    }
}

#Preview {
    HStack {
        PartyBadge(party: "Fianna Fáil")
        PartyBadge(party: "Sinn Féin")
        PartyBadge(party: "Fine Gael", small: true)
    }
    .padding()
}
