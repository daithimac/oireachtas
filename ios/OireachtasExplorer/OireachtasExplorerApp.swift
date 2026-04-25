import SwiftUI

@main
struct OireachtasExplorerApp: App {
    init() {
        // Photos and JSON from data.oireachtas.ie are stable, so a generous
        // shared cache eliminates repeat downloads as users scroll grids.
        URLCache.shared = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 200 * 1024 * 1024
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
