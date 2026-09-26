import SwiftUI

/// Renders a photo for guessing. Resolves three cases in priority order:
/// bundled image → remote URL (streamed, cached) → procedural placeholder.
struct PhotoCardView: View {
    let photo: AgePhoto
    var style: FaceStyle = .photo

    var body: some View {
        GeometryReader { geo in
            content
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
        }
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var content: some View {
        if style == .cartoon {
            // Cartoon mode: the illustrated face IS the content (age-expressive).
            CartoonFace(seed: ImageLoader.seed(for: photo.id), age: photo.age)
        } else if let name = photo.localImageName, let ui = ImageLoader.bundledImage(named: name) {
            Image(uiImage: ui)
                .resizable()
                .scaledToFill()
        } else if let url = photo.imageURL {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    ProceduralFace(id: photo.id)
                case .empty:
                    ZStack {
                        ProceduralFace(id: photo.id)
                        ProgressView()
                    }
                @unknown default:
                    ProceduralFace(id: photo.id)
                }
            }
        } else {
            ProceduralFace(id: photo.id)
        }
    }
}

/// A deterministic, gradient + silhouette stand-in used for the offline
/// placeholder seed and as a fallback when a streamed image fails to load.
struct ProceduralFace: View {
    let id: String

    var body: some View {
        let (top, bottom) = ImageLoader.placeholderColors(for: id)
        ZStack {
            LinearGradient(colors: [top, bottom], startPoint: .top, endPoint: .bottom)
            Image(systemName: "person.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.white.opacity(0.85))
                .padding(.top, 40)
                .padding(.horizontal, 56)
                .offset(y: 24)
        }
    }
}
