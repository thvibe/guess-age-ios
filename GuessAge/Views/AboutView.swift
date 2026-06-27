import SwiftUI

/// Photo credits / attribution screen. Creative Commons BY and BY-SA licenses
/// require visible attribution, so we list every credited photo with author,
/// license, and a link to the source file page.
struct AboutView: View {
    @EnvironmentObject private var store: DataStore

    var body: some View {
        List {
            Section {
                Text("Photos come from Wikimedia Commons and Wikidata. Each age is computed from the subject's documented birth date and the photo's capture date. Images are public domain or used under their Creative Commons licenses; credits are listed below.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if store.creditedPhotos.isEmpty {
                Section {
                    Text("No attributed photos are loaded yet. Run tools/build_dataset.py to fetch real, verified photos.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else {
                Section("Photo credits") {
                    ForEach(store.creditedPhotos) { photo in
                        creditRow(photo)
                    }
                }
            }
        }
        .navigationTitle("Photo credits")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func creditRow(_ photo: AgePhoto) -> some View {
        if let a = photo.attribution {
            VStack(alignment: .leading, spacing: 2) {
                Text(photo.name ?? "Photo")
                    .font(.subheadline.weight(.medium))
                Text("\(a.author) · \(a.license)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let url = a.sourceURL {
                    Link("Source", destination: url)
                        .font(.caption2)
                }
            }
        }
    }
}
