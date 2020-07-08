function buildBorder(bordercanvas, fontImage, fontInfo, w, h, border_sides) {

    function drawBorderPiece(x, y, piece) {
        bctx.drawImage(fontImage, piece.x, piece.y, piece.w, piece.h, x, y, piece.w, piece.h)
    }
    var bctx = bordercanvas.getContext('2d')
    if (bctx.canvas.width == w && bctx.canvas.height == h && bctx._border_sides == border_sides) {
        return
    }
    bctx._border_sides = border_sides
    bctx.canvas.width = w
    bctx.canvas.height = h
    var border = fontInfo.border
    // todo: support styles other than "copy", like "stretch"

    if (border_sides[4] == 't') {
        // Draw center
        if (border.c.mode == 'stretch') {
            var piece = border.c
            bctx.drawImage(fontImage,
                piece.x, piece.y, piece.w, piece.h,
                border.l.w, border.t.h,
                w - border.l.w - border.r.w, h - border.b.h - border.t.h
            )
        } else {
            for (var x = border.l.w; x < w - border.r.w; x += border.c.w) {
                for (var y = border.t.h; y < h - border.b.h; y += border.c.h) {
                    drawBorderPiece(x, y, border.c)
                }
            }
        }
    }
    if (border_sides[1] == 't') {
        // Draw top-center edge
        for (var x = border.tl.w; x < w - border.tr.w; x += border.t.w) {
            drawBorderPiece(x, 0, border.t)
        }
    }
    if (border_sides[7] == 't') {
        // Draw bottom-center edge
        for (var x = border.bl.w; x < w - border.br.w; x += border.b.w) {
            drawBorderPiece(x, h - border.b.h, border.b)
        }
    }
    if (border_sides[3] == 't') {
        // Draw left edge
        for (var y = border.tl.h; y < h - border.bl.h; y += border.l.h) {
            drawBorderPiece(0, y, border.l)
        }
    }
    if (border_sides[5] == 't') {
        // Draw right edge
        for (var y = border.tr.h; y < h - border.br.h; y += border.r.h) {
            drawBorderPiece(w - border.r.w, y, border.r)
        }
    }
    if (border_sides[0] == 't') {
        // Top-Left corner
        drawBorderPiece(0, 0, border.tl)
    }
    if (border_sides[2] == 't') {
        // Top-Right corner
        drawBorderPiece(w - border.tr.w, 0, border.tr)
    }
    if (border_sides[6] == 't') {
        // Bottom-Left corner
        drawBorderPiece(0, h - border.bl.h, border.bl)
    }
    if (border_sides[8] == 't') {
        // Bottom-Right corner
        drawBorderPiece(w - border.br.w, h - border.br.h, fontInfo.border.br)
    }

}

exports.buildBorder = buildBorder