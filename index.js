const { createCanvas, loadImage } = require('canvas')
const { renderText } = require('./js/render/render')
const fsp = require('fs').promises;

const parseJsonAsync = (jsonString) => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(JSON.parse(jsonString))
      })
    })
  }

const canvas = createCanvas(1000, 1000)

const loadImagePromise = loadImage('games/wea/wea-blank.png')
const fontImagePromise = loadImage('games/wea/wea-font.png') 
const jsonPromise = fsp.readFile('games/wea/wea.json').then(data => {
    return parseJsonAsync(data)
});

Promise.all([loadImagePromise, fontImagePromise, jsonPromise]).then((values) => {
    var fontInfo = values[2]
    var baseImage = values[0]
    var fontImage = values[1]
    renderText(canvas, fontInfo, baseImage, fontImage, "hello", false)
   
	console.log('<img src="' + canvas.toDataURL() + '" />')
  })