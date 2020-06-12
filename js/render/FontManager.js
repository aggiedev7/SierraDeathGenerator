const { first } = require('./util')

const glitch = false
class FontManager{
	constructor(context, text, fonts, fontInfo) {
		this.context = context
		this.text = text
		this.fonts = fonts
        this.lines = this.applyMarkup(fontInfo)
	}

	subset(other_text) {
		return new FontManager(this.context, other_text, this.fonts, this.fontInfo)
	}

	splitSnippet(font, text, fontInfo){
		var parts = text.split(/(\n)/)
		var out=[]
		for(var part of parts){
			if(part=='\n'){
				out.push(new NewLine())
			}else{
				out.push(new Snippet(font, part, fontInfo['height']))
			}
		}
		return out
	}

	buildLines(pieces){
		var out=[]
		var line = new LineGroup(true)
		for(var piece of pieces){
			if(piece instanceof NewLine){
				out.push(line)
				line = new LineGroup(false)
			}else{
				line.add(piece)
			}
		}
		if(!line.isEmpty()){
			out.push(line)
		}
		return out
	}

	wordwrap(maxwidth){

		function splitLine(line){
			var parts = line.split(maxwidth)
			if(parts.length==2){
				return [parts[0]].concat(splitLine(parts[1]))
			}else{ // should only be 1
				return parts
			}
		}

		var out=[]
		for(var line of this.lines){
			out = out.concat(splitLine(line))
		}
		this.lines = out
	}

	applyMarkup(fontInfo){
		var parts = this.text.split(/\[(\/?[:_a-zA-Z0-9]*)\]/)
		parts.unshift('/')
		var out=[]
		for(var i=0;i<parts.length;i+=2){
			var marker = parts[i]
			var text = parts[i+1]
			if(text!==''){ // Skip empty text segments
				if(marker.startsWith('/')){
					marker='main'
				}
				if(!(marker in this.fonts)){
					marker='main'
				}
				for(var snippet of this.splitSnippet(this.fonts[marker], text, fontInfo)){
					out.push(snippet)
				}
			}
		}
		return this.buildLines(out)
	}

	getHeight(){
		var height = 0
		for(var line of this.lines){
			height += line.getHeight()
		}
		return height
	}

	getWidth(){
		var width = 0
		for(var line of this.lines){
			width = Math.max(width,line.getWidth())
		}
		return width
	}

	draw(mainFont, scale, originx, justify, justifyresolution, fontOriginY, first_line_justify, first_line_origin, explicit_origins, output_size){
		var y = mainFont.y
		if(['v-center','all-center'].includes(justify)){
			y -= Math.floor(this.getHeight()/2)
		}
		for(let [line_number, line] of this.lines.entries()){
			var x = originx
			var origin_override = explicit_origins ? explicit_origins[line_number] : null
			if(origin_override){
				// We overwrite originx as well so this'll stick for later lines
				originx = x = first(origin_override['x'], originx)
				y = first(origin_override['y'], y)
			}
			if(line_number==0){
				x = first_line_origin
				if(first_line_justify == 'output-center'){
					x = Math.floor(output_size.w/2) - Math.floor(line.getWidth()/2);
					x = (x - (x % justifyresolution))
				}
			}
			if(['center','all-center'].includes(justify)){
				var jadjust = Math.floor(line.getWidth()/2);
				x = originx - (jadjust - (jadjust % justifyresolution));
			}
			if(justify=='right'){
				var jadjust = line.getWidth();
				x = originx - (jadjust - (jadjust % justifyresolution));
			}
			line.draw(this.context, scale, x, y)
			y+=line.getHeight()
		}
	}

	plainLines(){
		let out=[]
		for(var line of this.lines){
			out.push(line.asText())
		}
		return out
	}
}

class NewLine{
	constructor(){
		this.type = 'NewLine'
	}
}

class LineGroup{
	constructor(firstLine){
		this.firstLine=firstLine
		this.snippets = []
		this.height = 0
	}

	add(snippet){
		this.snippets.push(snippet)
		this.height = Math.max(this.height, snippet.getHeight(this.firstLine))
	}

	getWidth(){
		var w=0
		for(var snippet of this.snippets){
			w+=snippet.getWidth()
		}
		return w
	}

	getHeight(){
		return this.height
	}

	isEmpty(){
		return this.snippets.length == 0
	}

	split(maxwidth){
		if(this.getWidth()>maxwidth){
			var x=0;
			var out=[]
			var first=this.firstLine
			for(var snippet of this.snippets){
				var w=snippet.getWidth()
				if(x+w>maxwidth){
					var parts = snippet.split(maxwidth-x)
					for(var p of parts){
						var lg = new LineGroup(first)
						first=false
						lg.add(p)
						out.push(lg)
					}
					
					// TODO: rest of snippets?
					return out
				}else{
					x+=w
					var lg = new LineGroup(first)
					lg.add(snippet)
					out.push(snippet)
					first=false
				}
			}
			return out
		}else{
			return [this]
		}

	}

	draw(context, scale, xStart, y){
		var x = xStart
		for(let snippet of this.snippets){
			x = snippet.draw(context, scale, x, y)
		}
	}

	asText(){
		var out=[]
		for(let snippet of this.snippets){
			out.push(snippet.text)
		}
		return out.join("")
	}
}

class Snippet{
	constructor(font, text, defaultHeight){
		this.type = 'Snippet'
		this.font = font
        this.text = text
        this.defaultHeight = defaultHeight
	}

	split(maxwidth){
		var chars = this.parse()
		function widthSoFar(font, bk){
			var w=0
			for(var i=0;i<bk;i++){
				w+=first(chars[i], font.info[font.info["null-character"]]).w
			}
			return w
		}
		var lb = new LineBreak(this.text)
		var last=null
		var bk
		var firstLine=true
		while(bk = lb.nextBreak()){
			if(widthSoFar(this.font,bk.position)>maxwidth){
				if(firstLine){
					last=bk.position
				}
				break
			}
			firstLine=false
			last=bk.position
		}
		if(last==null){
			// We had no break points, or our first breakpoint was over the max. So we can't split
			return [this]
		}else{
			var before = new Snippet(this.font, this.text.slice(0,last), this.defaultHeight)
			var after = new Snippet(this.font, this.text.slice(last), this.defaultHeight)
			return [before, after]
		}
	}

	draw(context, scale, xStart, y){
		var x=xStart
		var last = 0
		var lastchar = -1 
		for(let char of this.parse()){
			if(lastchar in char['unadvance-after']){
				x-= char['unadvance-after'][lastchar]
			}
			context.drawImage(this.font.image,char.x,char.y,char.w,char.h,x*scale,y*scale + char['vertical-shift'],char.w*scale,char.h*scale)
			x+=(char.w - char.unadvance)
			last = char.unadvance
			lastchar = char.char
		}
		return x + last
	}

	parse(fontOriginY=0){
		var out=[]
		var font = this.font.info
		var defaultInfo = first(font.default, {})
		// FIXME: can doing uppercase/lowercase break astral codepoints?
		var line = this.text
		if(font['case-fold'] == 'upper'){
			line = line.toUpperCase()
		}else if(font['case-fold'] == 'lower'){
			line = line.toLowerCase()
		}
		var ligatures = first(font.ligatures, {})
		
		for(var i=0;i<line.length;i++){
			var c=line.charCodeAt(i)
			if(c>= 0xD800 && c<=0xDBFF){
				c = line.codePointAt(i)
				i++; // Can this be more than 2? ARG JS UNICODE IS BAD
			}
			var info=font[c]
			if(info==null){
				info=font[font["null-character"]]
			}
			var lig_unadvance = undefined
			var matching_ligatures = Object.keys(ligatures).filter(x=>line.substring(i,i+x.length)==x)
			if(matching_ligatures.length>0){
				// Pick the longest match if there are multiple matches
				matching_ligatures.sort((a,b) => b.length - a.length)
				var old_info = info
				info = ligatures[matching_ligatures[0]]
				var lig_chain = first(info['ligature-chain'], defaultInfo['ligature-chain'], 0)
				if(lig_chain>0){
					// FIXME: This won't calculate the correct unadvance if the chain is >1! 
					lig_unadvance = first(info.unadvance, defaultInfo.unadvance, 0) + first(old_info.w, defaultInfo.w) - 1 
				}
				// Extend i by the length of the ligature, minus 1 since the for loop will do i++
				i+= Math.max(0, (matching_ligatures[0].length -1 ) - lig_chain) 
			}
			var x=first(info.x, defaultInfo.x)
			if(glitch){
				x*=0.95
			}
			out.push({
				'x': x,
				'y': first(info.y, defaultInfo.y, fontOriginY),
				'w': first(info.w, defaultInfo.w),
				'h': first(info.h, defaultInfo.h),
				'unadvance': first(lig_unadvance, info.unadvance, defaultInfo.unadvance, 0),
				'unadvance-after': first(info['unadvance-after'],{}),
				'vertical-shift': first(info['vertical-shift'], 0),
				'char':c
			})
		}
		return out
	}

	getWidth(){
		var w=0
		var last = 0
		var lastchar = -1
		for(var char of this.parse()){
			last = char.unadvance
			w += char.w - char.unadvance
			if(lastchar in char['unadvance-after']){
				w-= char['unadvance-after'][lastchar]
			}
			lastchar = char.char
		}
		return w + last
	}

	getHeight(firstLine){
		var info = this.font.info
		if(firstLine){
			return first(info['first-height'], info['height'], this.defaultHeight)
		}else{
			return first(info['height'], this.defaultHeight)
		}
	}

}

exports.FontManager = FontManager