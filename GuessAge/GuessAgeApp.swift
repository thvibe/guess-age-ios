import SwiftUI

@main
struct GuessAgeApp: App {
    @StateObject private var store = DataStore()

    init() {
        ImageLoader.configureCache()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(.teal)
                .task {
                    // Grow the pool from the remote manifest once at launch.
                    await store.loadRemoteIfAvailable()
                }
        }
    }
}
