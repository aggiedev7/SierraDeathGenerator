const { first } = require('./util')
const { FontManager} = require('./FontManager')

function renderText(canvas, fontInfo, baseImage, fontImage, rawtext, scaled = true, wordwrap_dryrun=false, wordwrap=true){
	const context = canvas.getContext('2d')
	if(fontInfo == null || baseImage == null){
		return
	}

	if('hooks' in fontInfo && 'pre-parse' in fontInfo['hooks']){
		eval(fontInfo.hooks['pre-parse'])
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

	//TODO: support overlays
	//var overlays = parseOverlays(fontInfo)

	//var rawtext = document.querySelector("textarea#sourcetext").value

	function switchFont(newFont){
		rawtext = '[' + newFont + ']' + rawtext
	}

	if('hooks' in fontInfo && 'font' in fontInfo['hooks']){
		eval(fontInfo.hooks.font)
	}

	var fontManager = new FontManager(context, rawtext, fonts, fontInfo)
	if('wrap-width' in fontInfo && wordwrap){
		fontManager.wordwrap(fontInfo['wrap-width'])
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

	/*function drawOverlays(stage){
		Object.keys(overlays).forEach(function (key) {
			var adv = overlays[key]
			if(adv.stage == stage){
				context.globalCompositeOperation = adv.blend
				var overlay_x = adv.x*scale, overlay_y = adv.y*scale;
				var overlay_w = adv.w*scale, overlay_h = adv.h*scale
				var source_x = adv.source.x, source_y = adv.source.y
				var source_w = adv.w, source_h = adv.h
				var source_image = fontImage

				context.save()
				if(adv.flip!==''){
					context.translate(overlay_x, overlay_y)
					overlay_x=overlay_y=0
					if(adv.flip.toUpperCase().includes('H')){
						overlay_x = -overlay_w
						context.scale(-1, 1)
					}
					if(adv.flip.toUpperCase().includes('V')){
						overlay_y = -overlay_h
						context.scale(1, -1)
					}
				}
				if(key in overlayOverrides){
					source_image = overlayOverrides[key]
					source_x = source_y = 0 
					source_w = source_image.width
					source_h = source_image.height
				}
				context.drawImage(
					source_image,
					source_x, source_y, source_w, source_h,
					overlay_x,overlay_y,overlay_w,overlay_h
				)
				context.restore()
			}
		})
		context.globalCompositeOperation = "source-over"
	}*/

	// Clear before drawing, as transparents might get overdrawn
	context.clearRect(0, 0, canvas.width, canvas.height)
	context.drawImage(baseImage, 0, 0, baseImage.width*scale, baseImage.height*scale)
	
	//TODO: support overlays
	//drawOverlays('pre-border')

	if('border' in fontInfo) {
		var bw=outputSize.w,bh=outputSize.h
		var border_x = first(fontInfo.border.x, 0)
		var border_y = first(fontInfo.border.y, 0)
		var border_sides='ttttttttt'
		if('hooks' in fontInfo && 'border' in fontInfo['hooks']){
			// EVAL IS SAFE CODE, YES?
			eval(fontInfo['hooks']['border'])
		}
		buildBorder(fontImage,fontInfo,bw,bh,border_sides)
		var bordercanvas = document.querySelector('canvas#border')
		context.drawImage(bordercanvas,0,0,bw,bh,border_x*scale,border_y*scale,bw*scale, bh*scale)
	}

	if('hooks' in fontInfo && 'pre-overlays' in fontInfo['hooks']){
		// EVAL IS SAFE CODE, YES?
		eval(fontInfo['hooks']['pre-overlays'])
	}

	//TODO: support overlays
	//drawOverlays('pre-text')


	var fontOriginY=0

	if('hooks' in fontInfo && 'pre-text' in fontInfo['hooks']){
		// EVAL IS SAFE CODE, YES?
		eval(fontInfo['hooks']['pre-text'])
	}
	first_line_origin = first(first_line_origin, originx)
	fontManager.draw(mainFont, scale, originx, justify, justify_resolution, fontOriginY, first_line_justify, first_line_origin, explicit_origins, outputSize)

	//TODO: support overlays
	//drawOverlays('post-text')
	
}

/*function parseOverlays(fontInfo){
	var overlays = {}
	if ('overlays' in fontInfo) {
		for(var i=0;i<overlayNames.length;i++){
			var oname=overlayNames[i]
			var currentOverlay=fontInfo.overlays[oname]
			if(currentOverlay.type=='slider'){
				overlays[oname] = {
					"name":sname,
					"type":"slider",
					"min":currentOverlay.min,
					"max":currentOverlay.max,
					"value":$('#overlay-'+oname).val()
				}
			}else{
				var sname = $('#overlay-'+oname+' option:selected').val()
				var adv=currentOverlay.options[sname]

				overlays[oname] = {
					"name":sname,
					"type":"select",
					"x":currentOverlay.x,
					"y":currentOverlay.y,
					"w":adv.w,
					"h":adv.h,
					"blend":first(currentOverlay['blend-mode'], 'source-over'),
					"stage":first(currentOverlay.stage, "pre-text"),
					"title":first(currentOverlay.title,sname),
					"flip":first(adv.flip, currentOverlay.flip, ''),
					"source":{
						"x":adv.x,
						"y":adv.y
					},
					"data":adv
				}
			}
		}
	}
	return overlays
}*/

class BitmapFont {
	constructor(info, image) {
		this.info = info
		this.image = image
		this.y = info.origin.y
	}
}

function buildBorder(fontImage,fontInfo,w,h, border_sides){

	function drawBorderPiece(x,y,piece){
		bctx.drawImage(fontImage,piece.x,piece.y,piece.w,piece.h,x,y,piece.w,piece.h)
	}
	var bctx = document.querySelector('canvas#border').getContext('2d')
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