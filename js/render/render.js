const { first } = require('./util')
const { FontManager } = require('./FontManager')
const { drawOverlays, parseOverlays, resetOverlays } = require('./overlays')
const { createCanvas } = require('canvas')
const { evalHook } = require('./evalhooks')

function switchFont(newFont){
	rawtext = '[' + newFont + ']' + rawtext
}

function renderText(canvas, fontInfo, baseImage, fontImage, rawtext, options, scaled = true, wordwrap_dryrun=false, wordwrap=true){
	overlayOverrides={}
	overlayNames= resetOverlays(fontInfo)

	const context = canvas.getContext('2d')
	if(fontInfo == null || baseImage == null){
		return
	}

	if('hooks' in fontInfo && 'pre-parse' in fontInfo['hooks']){
		eval(evalHook(fontInfo.hooks['pre-parse'], options))
	}
	if(!('null-character' in fontInfo)){
		// Set a null character fallback if the JSON doesn't define one
		if('32' in fontInfo){
			// space is a good default, what font doesn't have space? 
			// A BAD ONE!
			fontInfo['null-character']='32'
		}else{
			var validcharacters = Object.keys(fontInfo).filter(x=>Number.isInteger(-x))
			fontInfo['null-character'] = validcharacters[0]
		}
	}
	// Define the top-level font
	var mainFont = new BitmapFont(fontInfo, fontImage)
	var fonts={
		'main': mainFont
	}
	if('subfonts' in fontInfo){
		for(var key of Object.keys(fontInfo.subfonts)){
			fonts[key] = new BitmapFont(fontInfo.subfonts[key], fontImage)
		}
	}
	if('shiftfonts' in fontInfo){
		for(var key of Object.keys(fontInfo.shiftfonts)){
			// Make a local clone of the JSON tree
			var fontcopy = JSON.parse(JSON.stringify(fontInfo))
			if(!'default' in fontcopy){
				fontcopy['default'] = {}
			}
			fontcopy['default']['y'] = fontInfo.shiftfonts[key]
			delete fontcopy['height'] // Allow changes to the main object to be reflected into the subfont
			fonts[key] = new BitmapFont(fontcopy, fontImage)
		}
	}
	var originx = first(fontInfo.origin.x, 0)

	var overlays = parseOverlays(fontInfo, overlayNames, options)

	//var rawtext = document.querySelector("textarea#sourcetext").value

	function switchFont(newFont){
		rawtext = '[' + newFont + ']' + rawtext
	}

	if('hooks' in fontInfo && 'font' in fontInfo['hooks']){
		eval(evalHook(fontInfo.hooks.font, options))
	}

	var fontManager = new FontManager(context, rawtext, fonts, fontInfo)
	if('wrap-width' in fontInfo && wordwrap){
		fontManager.wordwrap(fontInfo['wrap-width'])
	}
	else {
		fontManager.wordwrap(150)
	}

	if(wordwrap_dryrun){
		return fontManager
	}

	var justify = first(fontInfo.justify, 'left')
	var justify_resolution = first(fontInfo['justify-resolution'],1)
	var first_line_justify = first(fontInfo['first-line-justify'], justify)
	var first_line_origin = fontInfo['first-line-origin']

	// TODO: Retire first_line_origin as explicit-origins can do everything it can and more
	var explicit_origins = fontInfo['explicit-origins']

	var textbox={
		w: fontManager.getWidth(),
		h: fontManager.getHeight()
	}
	if(justify == 'center-box'){
		originx -= Math.floor(textbox.w/2)
	}else if(justify == 'right-box'){
		originx -= textbox.w
	}


	var outputSize={
		w:baseImage.width,
		h:baseImage.height
	}
	if('dynamic-size' in fontInfo){
		outputSize.w = eval(fontInfo['dynamic-size'].w)
		outputSize.h = eval(fontInfo['dynamic-size'].h)
	}
	var buffer = 10

	var fontScale = first(fontInfo.scale, 2);

	var scale = fontScale


	context.canvas.width = outputSize.w * scale
	context.canvas.height = outputSize.h * scale
	var scaleMode = first(fontInfo['scale-mode'],'auto')
	if(scaleMode == 'nearest-neighbor' || (scaleMode == 'auto' && scale == 2.0)){
		context.imageSmoothingEnabled = false
	}

	// Clear before drawing, as transparents might get overdrawn
	context.clearRect(0, 0, canvas.width, canvas.height)
	context.drawImage(baseImage, 0, 0, baseImage.width*scale, baseImage.height*scale)
	
	drawOverlays(context, fontImage, overlays, overlayOverrides, scale, 'pre-border')

	if('border' in fontInfo) {
		var bw=outputSize.w,bh=outputSize.h
		var border_x = first(fontInfo.border.x, 0)
		var border_y = first(fontInfo.border.y, 0)
		var border_sides='ttttttttt'
		const bordercanvas = createCanvas(1000, 1000)
		if('hooks' in fontInfo && 'border' in fontInfo['hooks']){
			// EVAL IS SAFE CODE, YES?
			eval(evalHook(fontInfo['hooks']['border'], options))
		}
		buildBorder(bordercanvas, fontImage,fontInfo,bw,bh,border_sides)
		context.drawImage(bordercanvas,0,0,bw,bh,border_x*scale,border_y*scale,bw*scale, bh*scale)
	}

	if('hooks' in fontInfo && 'pre-overlays' in fontInfo['hooks']){
		// EVAL IS SAFE CODE, YES?
		eval(evalHook(fontInfo['hooks']['pre-overlays'], options))
	}

	drawOverlays(context, fontImage, overlays, overlayOverrides, scale, 'pre-text')


	var fontOriginY=0

	if('hooks' in fontInfo && 'pre-text' in fontInfo['hooks']){
		// EVAL IS SAFE CODE, YES?
		eval(evalHook(fontInfo['hooks']['pre-text'], options))
	}
	first_line_origin = first(first_line_origin, originx)
	fontManager.draw(mainFont, scale, originx, justify, justify_resolution, fontOriginY, first_line_justify, first_line_origin, explicit_origins, outputSize)

	drawOverlays(context, fontImage, overlays, overlayOverrides, scale, 'post-text')
	
}

class BitmapFont {
	constructor(info, image) {
		this.info = info
		this.image = image
		this.y = info.origin.y
	}
}

function buildBorder(bordercanvas, fontImage,fontInfo,w,h, border_sides){

	function drawBorderPiece(x,y,piece){
		bctx.drawImage(fontImage,piece.x,piece.y,piece.w,piece.h,x,y,piece.w,piece.h)
	}
	var bctx = bordercanvas.getContext('2d')
	if(bctx.canvas.width == w && bctx.canvas.height == h && bctx._border_sides == border_sides){
		return
	}
	bctx._border_sides = border_sides
	bctx.canvas.width = w
	bctx.canvas.height = h
	var border = fontInfo.border
	// todo: support styles other than "copy", like "stretch"

	if(border_sides[4]=='t'){
		// Draw center
		if(border.c.mode=='stretch'){
			var piece = border.c
			bctx.drawImage(fontImage,
				piece.x,piece.y,piece.w,piece.h,
				border.l.w,border.t.h,
				w-border.l.w-border.r.w,h-border.b.h-border.t.h
			)
		}else{
			for(var x=border.l.w;x<w-border.r.w;x+=border.c.w){
				for(var y=border.t.h;y<h-border.b.h;y+=border.c.h){
					drawBorderPiece(x,y,border.c)
				}
			}
		}
	}
	if(border_sides[1]=='t'){
		// Draw top-center edge
		for(var x=border.tl.w;x<w-border.tr.w;x+=border.t.w){
			drawBorderPiece(x,0,border.t)
		}
	}
	if(border_sides[7]=='t'){
		// Draw bottom-center edge
		for(var x=border.bl.w;x<w-border.br.w;x+=border.b.w){
			drawBorderPiece(x,h-border.b.h,border.b)
		}
	}
	if(border_sides[3]=='t'){
		// Draw left edge
		for(var y=border.tl.h;y<h-border.bl.h;y+=border.l.h){
			drawBorderPiece(0,y,border.l)
		}
	}
	if(border_sides[5]=='t'){
		// Draw right edge
		for(var y=border.tr.h;y<h-border.br.h;y+=border.r.h){
			drawBorderPiece(w-border.r.w,y,border.r)
		}
	}
	if(border_sides[0]=='t'){
		// Top-Left corner
		drawBorderPiece(0,0,border.tl)
	}
	if(border_sides[2]=='t'){
		// Top-Right corner
		drawBorderPiece(w-border.tr.w,0,border.tr)
	}
	if(border_sides[6]=='t'){
		// Bottom-Left corner
		drawBorderPiece(0,h-border.bl.h,border.bl)
	}
	if(border_sides[8]=='t'){
		// Bottom-Right corner
		drawBorderPiece(w-border.br.w,h-border.br.h,fontInfo.border.br)
	}

}

exports.renderText = renderText