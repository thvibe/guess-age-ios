import SwiftUI

/// Photo credits / attribution screen. Creative Commons BY and BY-SA licenses
/// require visible attribution, so we list every credited photo with author,
/// license, and a link to the source file page.
struct AboutView: View {
    @EnvironmentObject private var store: DataStore

    var body: some View {
        List {
            Section {
                Text("Cartoon faces are drawn in the app — synthetic, depicting no real people, each created at a target age (the correct answer). Photo mode, if you load a dataset, shows real people whose ages are verified from public records; those are credited below.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if !store.creditedPhotos.isEmpty {
                // Shown only if you also load real, licensed photos (hybrid mode).
                Section("Photo credits") {
                    ForEach(store.creditedPhotos) { photo in
                        creditRow(photo)
                    }
                }
            }
        }
        .navigationTitle("About the images")
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
