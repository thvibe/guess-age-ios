import Foundation

/// Loads photo data: the bundled offline seed first (so the game is instantly
/// playable with no network), then asynchronously appends the remote manifest.
@MainActor
final class DataStore: ObservableObject {

    /// All known photos, deduplicated by `id`. Seed entries load synchronously;
    /// streamed entries are appended when/if the manifest fetch succeeds.
    @Published private(set) var photos: [AgePhoto] = []

    /// True once the (optional) remote manifest fetch has completed or failed.
    @Published private(set) var didLoadRemote = false

    private var seenIDs = Set<String>()
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
        loadSeed()
    }

    /// Test/preview seam: build a store from in-memory photos, skipping the
    /// bundle load so behavior is deterministic and isolated.
    init(photos: [AgePhoto], session: URLSession = .shared) {
        self.session = session
        append(photos)
    }

    /// Synchronously load the bundled seed so the first screen has data.
    private func loadSeed() {
        guard let url = Bundle.main.url(forResource: AppConfig.seedResourceName, withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            return
        }
        if let manifest = try? JSONDecoder().decode(PhotoManifest.self, from: data) {
            append(manifest.photos)
        }
    }

    /// Fetch the remote manifest and append any new photos. Non-fatal on error;
    /// the seed keeps the game playable.
    func loadRemoteIfAvailable() async {
        defer { didLoadRemote = true }
        guard let url = AppConfig.manifestURL else { return }
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else { return }
            let manifest = try JSONDecoder().decode(PhotoManifest.self, from: data)
            append(manifest.photos)
        } catch {
            // Offline or bad manifest: stay on the seed silently.
        }
    }

    /// All photos whose license requires a visible credit, for the About screen.
    var creditedPhotos: [AgePhoto] {
        photos.filter { $0.attribution?.requiresAttribution == true }
    }

    private func append(_ incoming: [AgePhoto]) {
        var added: [AgePhoto] = []
        for photo in incoming where !seenIDs.contains(photo.id) {
            seenIDs.insert(photo.id)
            added.append(photo)
        }
        if !added.isEmpty { photos.append(contentsOf: added) }
    }
}
