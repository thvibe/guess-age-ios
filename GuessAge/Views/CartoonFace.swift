import SwiftUI

/// A procedurally drawn cartoon face whose apparent age is driven by `age` and
/// whose look (skin, hair, glasses, etc.) is deterministic from `seed`. This is
/// the native SwiftUI port of the illustrated faces from the web demo — used by
/// the game's Cartoon mode, which (unlike AI photos) includes children.
struct CartoonFace: View {
    let seed: UInt32
    let age: Int

    var body: some View {
        Canvas { ctx, size in
            CartoonFace.draw(in: &ctx, size: size, age: age, seed: seed)
        }
        .drawingGroup()
    }

    // MARK: Drawing

    private typealias RGB = (r: Double, g: Double, b: Double)

    private static let skinTones: [RGB] = [
        (243,211,182),(234,184,146),(217,154,108),(193,129,90),
        (169,104,63),(138,82,48),(247,221,195),(224,168,120)
    ]
    private static let hairColors: [RGB] = [
        (43,35,32),(74,53,42),(111,74,47),(160,106,60),
        (201,154,84),(122,74,58),(28,26,27),(140,109,74)
    ]
    private static let clothColors: [RGB] = [
        (74,111,165),(94,92,230),(58,157,118),(198,91,91),
        (209,139,61),(90,107,122),(122,90,160),(63,143,138)
    ]

    private static func color(_ c: RGB, _ alpha: Double = 1) -> Color {
        Color(.sRGB, red: c.r/255, green: c.g/255, blue: c.b/255, opacity: alpha)
    }
    private static func mix(_ a: RGB, _ b: RGB, _ t: Double) -> RGB {
        (a.r+(b.r-a.r)*t, a.g+(b.g-a.g)*t, a.b+(b.b-a.b)*t)
    }
    private static func shade(_ a: RGB, _ t: Double) -> RGB {
        t < 0 ? (a.r*(1+t), a.g*(1+t), a.b*(1+t))
              : (a.r+(255-a.r)*t, a.g+(255-a.g)*t, a.b+(255-a.b)*t)
    }
    private static func cl01(_ x: Double) -> Double { min(1, max(0, x)) }

    private static func ellipse(_ cx: Double, _ cy: Double, _ rx: Double, _ ry: Double) -> Path {
        Path(ellipseIn: CGRect(x: cx - rx, y: cy - ry, width: rx*2, height: ry*2))
    }

    static func draw(in ctx: inout GraphicsContext, size: CGSize, age: Int, seed: UInt32) {
        var g = SeededGenerator(seed: seed)
        let W = Double(size.width), H = Double(size.height)
        let unit = min(W, H)
        let cx = W/2, cy = H*0.5

        // Backdrop gradient (echoes the neutral placeholder).
        let h1 = g.next01(), h2 = (h1 + 0.11 + g.next01()*0.22).truncatingRemainder(dividingBy: 1)
        let bg = Gradient(colors: [
            Color(hue: h1, saturation: 0.42, brightness: 0.84),
            Color(hue: h2, saturation: 0.40, brightness: 0.62)
        ])
        ctx.fill(Path(CGRect(x: 0, y: 0, width: W, height: H)),
                 with: .linearGradient(bg, startPoint: .zero, endPoint: CGPoint(x: 0, y: H)))

        // Age-derived features.
        let t = Double(min(max(age, 1), 99))
        let gray = cl01((t-36)/40)
        let recede = cl01((t-46)/38)
        let wrinkle = cl01((t-27)/50)
        let child = cl01((16 - t)/13)

        let skin = skinTones[Int(g.next01()*Double(skinTones.count))]
        var hair = hairColors[Int(g.next01()*Double(hairColors.count))]
        hair = mix(hair, (210,210,214), gray*0.9)
        let cloth = clothColors[Int(g.next01()*Double(clothColors.count))]
        let glasses = g.next01() < (0.14 + 0.5*cl01((t-42)/40))
        let longHair = g.next01() < (child > 0.3 ? 0.55 : 0.42)
        let beard = !longHair && t >= 18 && t < 74 && g.next01() < 0.34
        let balding = longHair ? 0 : recede * (g.next01() < 0.6 ? 1 : 0.3)

        let faceW = unit*(0.30 + child*0.02)
        let faceH = unit*(0.37 - child*0.02)
        let eyeY = cy - faceH*0.04
        let eyeDX = faceW*0.42
        let eyeR = faceW*0.11
        let mY = cy + faceH*0.48

        // Long hair behind the head/shoulders (drawn first).
        if longHair {
            ctx.fill(ellipse(cx, cy+faceH*0.15, faceW*1.28, faceH*1.15), with: .color(color(hair)))
        }

        // Shoulders.
        var shoulders = Path()
        shoulders.addEllipse(in: CGRect(x: cx-faceW*1.5, y: cy+faceH*0.25, width: faceW*3, height: faceH*1.8))
        shoulders.addRect(CGRect(x: cx-faceW*1.5, y: cy+faceH*1.15, width: faceW*3, height: faceH))
        ctx.fill(shoulders, with: .color(color(cloth)))

        // Neck.
        ctx.fill(Path(CGRect(x: cx-faceW*0.28, y: cy+faceH*0.5, width: faceW*0.56, height: faceH*0.5)),
                 with: .color(color(shade(skin, -0.12))))

        // Ears.
        for s in [-1.0, 1.0] {
            ctx.fill(ellipse(cx+s*faceW*0.98, cy+faceH*0.05, faceW*0.16, faceH*0.16), with: .color(color(skin)))
        }

        // Head.
        ctx.fill(ellipse(cx, cy, faceW, faceH), with: .color(color(skin)))

        // Hair cap.
        if child > 0.05 || balding < 0.85 {
            let cap = faceW*1.02
            // Younger faces get a fuller, lower hairline so they never read bald.
            let brow = cy - faceH*(0.34 - balding*0.28 - child*0.10)
            var hp = Path()
            hp.move(to: CGPoint(x: cx-cap, y: brow))
            hp.addCurve(to: CGPoint(x: cx+cap, y: brow),
                        control1: CGPoint(x: cx-cap, y: cy-faceH*0.98),
                        control2: CGPoint(x: cx+cap, y: cy-faceH*0.98))
            hp.addCurve(to: CGPoint(x: cx-cap, y: brow),
                        control1: CGPoint(x: cx+cap*0.6, y: cy-faceH*(0.62-balding*0.3)),
                        control2: CGPoint(x: cx-cap*0.6, y: cy-faceH*(0.62-balding*0.3)))
            ctx.fill(hp, with: .color(color(hair)))
        }
        if balding > 0.4 {
            ctx.fill(ellipse(cx, cy-faceH*0.5, faceW*0.55, faceH*0.4), with: .color(.white.opacity(0.10)))
        }

        // Eyebrows.
        for s in [-1.0, 1.0] {
            let by = eyeY - faceH*0.22 + wrinkle*faceH*0.02
            var b = Path()
            b.move(to: CGPoint(x: cx+s*eyeDX - eyeR, y: by))
            b.addQuadCurve(to: CGPoint(x: cx+s*eyeDX + eyeR, y: by), control: CGPoint(x: cx+s*eyeDX, y: by - faceH*0.05))
            ctx.stroke(b, with: .color(color(mix(hair,(80,70,66),0.3))),
                       style: StrokeStyle(lineWidth: max(2, faceW*0.05), lineCap: .round))
        }

        // Eyes.
        for s in [-1.0, 1.0] {
            ctx.fill(ellipse(cx+s*eyeDX, eyeY, eyeR, eyeR*0.7), with: .color(.white))
            ctx.fill(ellipse(cx+s*eyeDX, eyeY, eyeR*0.42, eyeR*0.42), with: .color(color((58,47,42))))
        }

        // Glasses.
        if glasses {
            let gc = Color.black.opacity(0.72)
            let lw = max(2, faceW*0.035)
            for s in [-1.0, 1.0] {
                ctx.stroke(ellipse(cx+s*eyeDX, eyeY, eyeR*1.5, eyeR*1.2), with: .color(gc), lineWidth: lw)
            }
            var bridge = Path()
            bridge.move(to: CGPoint(x: cx-eyeDX+eyeR*1.5, y: eyeY))
            bridge.addLine(to: CGPoint(x: cx+eyeDX-eyeR*1.5, y: eyeY))
            ctx.stroke(bridge, with: .color(gc), lineWidth: lw)
        }

        // Nose.
        var nose = Path()
        nose.move(to: CGPoint(x: cx, y: eyeY+faceH*0.06))
        nose.addLine(to: CGPoint(x: cx-faceW*0.08, y: eyeY+faceH*0.24))
        nose.addQuadCurve(to: CGPoint(x: cx+faceW*0.05, y: eyeY+faceH*0.24), control: CGPoint(x: cx, y: eyeY+faceH*0.3))
        ctx.stroke(nose, with: .color(color(shade(skin,-0.22))),
                   style: StrokeStyle(lineWidth: max(2, faceW*0.04), lineCap: .round))

        // Mouth.
        var mouth = Path()
        mouth.move(to: CGPoint(x: cx-faceW*0.3, y: mY))
        mouth.addQuadCurve(to: CGPoint(x: cx+faceW*0.3, y: mY), control: CGPoint(x: cx, y: mY + faceH*(0.12 - child*0.02)))
        ctx.stroke(mouth, with: .color(color(shade(skin,-0.4))),
                   style: StrokeStyle(lineWidth: max(2, faceW*0.05), lineCap: .round))

        // Beard.
        if beard {
            var bd = Path()
            bd.move(to: CGPoint(x: cx-faceW*0.86, y: eyeY+faceH*0.2))
            bd.addQuadCurve(to: CGPoint(x: cx+faceW*0.86, y: eyeY+faceH*0.2), control: CGPoint(x: cx, y: cy+faceH*1.16))
            bd.addQuadCurve(to: CGPoint(x: cx-faceW*0.86, y: eyeY+faceH*0.2), control: CGPoint(x: cx, y: cy+faceH*0.7))
            ctx.fill(bd, with: .color(color(mix(hair,(60,50,46),0.2), 0.92)))
        }

        // Wrinkles.
        if wrinkle > 0.02 {
            let wc = Color(.sRGB, red: 90/255, green: 60/255, blue: 45/255, opacity: 0.10 + wrinkle*0.32)
            let lw = max(1, faceW*0.02)
            let lines = Int((1 + wrinkle*2).rounded())
            for i in 0..<lines {
                let y = cy-faceH*0.42 + Double(i)*faceH*0.09
                var l = Path()
                l.move(to: CGPoint(x: cx-faceW*0.5, y: y))
                l.addQuadCurve(to: CGPoint(x: cx+faceW*0.5, y: y), control: CGPoint(x: cx, y: y-faceH*0.02))
                ctx.stroke(l, with: .color(wc), lineWidth: lw)
            }
            for s in [-1.0, 1.0] {
                var f = Path()
                f.move(to: CGPoint(x: cx+s*faceW*0.16, y: eyeY+faceH*0.24))
                f.addQuadCurve(to: CGPoint(x: cx+s*faceW*0.34, y: mY+faceH*0.02), control: CGPoint(x: cx+s*faceW*0.42, y: mY-faceH*0.06))
                ctx.stroke(f, with: .color(wc), lineWidth: lw)
            }
        }

        // Rosy cheeks for kids.
        if child > 0.2 {
            let rc = Color(.sRGB, red: 1, green: 120/255, blue: 120/255, opacity: 0.12 + child*0.18)
            for s in [-1.0, 1.0] {
                ctx.fill(ellipse(cx+s*faceW*0.5, cy+faceH*0.22, faceW*0.16, faceH*0.11), with: .color(rc))
            }
        }
    }
}

/// Small deterministic RNG (mulberry32) so a face renders identically each time
/// from the same seed. Matches the demo's generator.
struct SeededGenerator {
    private var state: UInt32
    init(seed: UInt32) { state = seed == 0 ? 0x9E3779B9 : seed }
    mutating func next01() -> Double {
        state = state &+ 0x6D2B79F5
        var r = (state ^ (state >> 15)) &* (state | 1)
        r ^= r &+ ((r ^ (r >> 7)) &* (r | 61))
        return Double(r ^ (r >> 14)) / 4294967296.0
    }
}
