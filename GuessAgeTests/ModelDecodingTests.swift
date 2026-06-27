import XCTest
@testable import GuessAge

final class ModelDecodingTests: XCTestCase {

    func testDecodesManifestWithStreamedAndLocalPhotos() throws {
        let json = """
        {
          "version": 1,
          "photos": [
            {
              "id": "Q42",
              "age": 33,
              "imageURL": "https://upload.wikimedia.org/example.jpg",
              "name": "Example Person",
              "attribution": {
                "author": "A Photographer",
                "license": "CC BY-SA 4.0",
                "sourceURL": "https://commons.wikimedia.org/wiki/File:Example.jpg"
              }
            },
            {
              "id": "placeholder-001",
              "age": 7
            }
          ]
        }
        """
        let manifest = try JSONDecoder().decode(PhotoManifest.self, from: Data(json.utf8))
        XCTAssertEqual(manifest.version, 1)
        XCTAssertEqual(manifest.photos.count, 2)

        let streamed = manifest.photos[0]
        XCTAssertEqual(streamed.id, "Q42")
        XCTAssertEqual(streamed.age, 33)
        XCTAssertEqual(streamed.imageURL?.host, "upload.wikimedia.org")
        XCTAssertEqual(streamed.attribution?.license, "CC BY-SA 4.0")

        // Minimal placeholder entry: optional fields absent, still valid.
        let placeholder = manifest.photos[1]
        XCTAssertEqual(placeholder.age, 7)
        XCTAssertNil(placeholder.imageURL)
        XCTAssertNil(placeholder.attribution)
        XCTAssertNil(placeholder.name)
    }

    func testRequiresAttributionByLicense() {
        func attribution(_ license: String) -> Attribution {
            Attribution(author: "x", license: license, sourceURL: nil)
        }
        // Attribution-required licenses.
        XCTAssertTrue(attribution("CC BY-SA 4.0").requiresAttribution)
        XCTAssertTrue(attribution("CC BY 2.0").requiresAttribution)
        // Royalty-free, no attribution legally required.
        XCTAssertFalse(attribution("CC0").requiresAttribution)
        XCTAssertFalse(attribution("Public domain").requiresAttribution)
        XCTAssertFalse(attribution("PD-old").requiresAttribution)
    }

    func testBundledSeedDecodes() throws {
        // The seed.json that ships in the app bundle must always be decodable.
        let bundle = Bundle(for: type(of: self))
        // In a hosted unit test the app bundle is the test host; fall back to
        // the test bundle if the resource is colocated.
        let url = Bundle.main.url(forResource: "seed", withExtension: "json")
            ?? bundle.url(forResource: "seed", withExtension: "json")
        let seedURL = try XCTUnwrap(url, "seed.json should be bundled with the app")
        let data = try Data(contentsOf: seedURL)
        let manifest = try JSONDecoder().decode(PhotoManifest.self, from: data)
        XCTAssertFalse(manifest.photos.isEmpty, "seed should contain photos to play")
        for photo in manifest.photos {
            XCTAssertGreaterThanOrEqual(photo.age, 1)
            XCTAssertLessThanOrEqual(photo.age, 99)
        }
    }
}
