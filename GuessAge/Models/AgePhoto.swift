import Foundation

/// Attribution metadata for a photo. Required for Creative Commons compliance
/// (CC BY / CC BY-SA need author + license + a link back to the source).
struct Attribution: Codable, Equatable, Hashable {
    /// Author / photographer credit line (e.g. "Jane Doe").
    var author: String
    /// Short license name (e.g. "CC BY-SA 4.0", "CC0", "Public domain").
    var license: String
    /// Link to the source file page (e.g. the Wikimedia Commons file page).
    var sourceURL: URL?

    /// True for licenses that legally require visible attribution.
    var requiresAttribution: Bool {
        let l = license.lowercased()
        if l.contains("cc0") { return false }
        if l.contains("public domain") || l.contains("pd-") { return false }
        return true
    }
}

/// A single playable item: a person's photo with a *verified* age.
///
/// "Verified" means the age was computed from documented data — the subject's
/// birth date (Wikidata P569) and the photo's capture date (Commons EXIF
/// `DateTimeOriginal`) — not estimated. See `tools/build_dataset.py`.
struct AgePhoto: Codable, Identifiable, Equatable, Hashable {
    /// Stable unique id (e.g. Wikidata QID + Commons file id).
    var id: String

    /// The verified age of the person in the photo, in whole years.
    var age: Int

    /// Remote image URL (used when streaming from the manifest). Optional.
    var imageURL: URL?

    /// Name of a bundled image resource (used by the offline seed). Optional.
    var localImageName: String?

    /// The subject's name. Hidden during guessing (it would give the answer
    /// away for recognizable people); revealed with credit after answering.
    var name: String?

    /// Licensing / credit info.
    var attribution: Attribution?

    enum CodingKeys: String, CodingKey {
        case id, age, imageURL, localImageName, name, attribution
    }
}

/// The kind of image the game shows. The player chooses this.
enum FaceStyle: String, CaseIterable, Identifiable {
    /// Illustrated faces drawn in-app (includes children).
    case cartoon
    /// Real photographs with verified ages from the dataset (adults only).
    case photo

    var id: String { rawValue }
    var label: String { self == .cartoon ? "Cartoon" : "Photos" }
}

/// Top-level shape of a `seed.json` / `manifest.json` document.
struct PhotoManifest: Codable {
    /// Schema version, for forward compatibility.
    var version: Int
    /// The photos.
    var photos: [AgePhoto]

    init(version: Int = 1, photos: [AgePhoto]) {
        self.version = version
        self.photos = photos
    }
}
