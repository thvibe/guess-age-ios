import Foundation

/// App-wide tunables and endpoints.
enum AppConfig {
    /// Remote manifest streamed to grow the photo pool beyond the bundled seed.
    ///
    /// Set this to the URL where you host the `manifest.json` produced by
    /// `tools/build_dataset.py`. Until it points at a real file the app runs
    /// fully on the bundled seed (hybrid delivery: offline-first, stream-more).
    static let manifestURL: URL? = URL(string: "https://example.com/guessage/manifest.json")

    /// Name of the bundled seed file (in the app bundle, no extension change).
    static let seedResourceName = "seed"

    /// Refill the play queue when it drops to this many remaining items.
    static let refillThreshold = 5

    /// Disk + memory cache budget for streamed images.
    static let imageCacheMemoryBytes = 32 * 1024 * 1024
    static let imageCacheDiskBytes = 256 * 1024 * 1024
}
