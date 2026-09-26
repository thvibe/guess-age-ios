import SwiftUI

/// Photo credits / attribution screen. Creative Commons BY and BY-SA licenses
/// require visible attribution, so we list every credited photo with author,
/// license, and a link to the source file page.
struct AboutView: View {
    @EnvironmentObject private var store: DataStore

    var body: some View {
        List {
            Section {
                Text("The faces in this game are AI-generated. They are synthetic and depict no real people — each one is created at a target age, which is the correct answer. Because no real person is shown, there are no likeness or copyright concerns.")
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
