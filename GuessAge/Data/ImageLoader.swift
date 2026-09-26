import SwiftUI
import UIKit

/// Image cache configuration + helpers for turning an `AgePhoto` into a view.
enum ImageLoader {

    /// Install a generous shared URLCache so streamed photos are reused across
    /// rounds and launches. Call once at startup.
    static func configureCache() {
        URLCache.shared = URLCache(
            memoryCapacity: AppConfig.imageCacheMemoryBytes,
            diskCapacity: AppConfig.imageCacheDiskBytes,
            diskPath: "guessage_images"
        )
    }

    /// Resolve a bundled seed image by base name. Checks an asset catalog first,
    /// then loose files in the bundled `Seed/` folder (where `build_dataset.py`
    /// downloads them), then the bundle root.
    static func bundledImage(named name: String) -> UIImage? {
        if let asset = UIImage(named: name) { return asset }
        let exts = ["jpg", "jpeg", "png", "webp"]
        for ext in exts {
            if let url = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "Seed"),
               let data = try? Data(contentsOf: url) {
                return UIImage(data: data)
            }
        }
        for ext in exts {
            if let url = Bundle.main.url(forResource: name, withExtension: ext),
               let data = try? Data(contentsOf: url) {
                return UIImage(data: data)
            }
        }
        return nil
    }

    /// A stable 32-bit seed derived from an id, for deterministic cartoon faces.
    static func seed(for id: String) -> UInt32 {
        var hash: UInt32 = 2166136261
        for byte in id.utf8 {
            hash = (hash ^ UInt32(byte)) &* 16777619
        }
        return hash
    }

    /// A stable color derived from an id, used for procedural placeholder faces
    /// so the offline seed looks varied without bundling any binary assets.
    static func placeholderColors(for id: String) -> (Color, Color) {
        var hash: UInt64 = 1469598103934665603
        for byte in id.utf8 {
            hash = (hash ^ UInt64(byte)) &* 1099511628211
        }
        let hue1 = Double(hash % 360) / 360.0
        let hue2 = Double((hash / 360) % 360) / 360.0
        return (
            Color(hue: hue1, saturation: 0.45, brightness: 0.85),
            Color(hue: hue2, saturation: 0.55, brightness: 0.6)
        )
    }
}
