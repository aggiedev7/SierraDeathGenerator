const { first } = require('./util')

function resetOverlays(fontInfo){
    overlayNames = []
    if('overlays' in fontInfo) {
        var overlays = fontInfo.overlays
        for (key in overlays) {
            if (overlays.hasOwnProperty(key)) {
                overlayNames.push(key)
            }
        }
    }
    return overlayNames
}

function parseOverlays(fontInfo, overlayNames, options){
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
					"value": options['sliderAmount']
				}
			}else{
				var sname = oname in options ? options[oname] : currentOverlay['default']
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
}

function drawOverlays(context, fontImage, overlays, overlayOverrides, scale, stage){
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
}

exports.resetOverlays = resetOverlays
exports.parseOverlays = parseOverlays
exports.drawOverlays = drawOverlays