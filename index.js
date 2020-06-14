const { createCanvas, loadImage } = require('canvas')
const { renderText } = require('./js/render/render')
const fsp = require('fs').promises;
const argv = require('yargs')
  .argv
const { Client, MessageAttachment } = require('discord.js');

const parseJsonAsync = (jsonString) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(JSON.parse(jsonString))
    })
  })
}

function getGame(argv, games) {
  return 'g' in argv ? getFontInfoForGame(argv.g).then(([_, fontInfo]) => [argv.g, fontInfo]) : getRandomGameWithWordwrap(games)
}

function getRandomGame(games) {
  return games[Math.floor(Math.random() * games.length)]
}

var text = argv._.join(" ")

function getRandomGameWithWordwrap(games) {
  return getFontInfoForGame(getRandomGame(games)).then(([game, fontInfo]) => 
  ('wrap-width' in fontInfo) ? [game, fontInfo] : getRandomGameWithWordwrap(games))
  .catch(err => {
    if (err.code  === 'ENOENT') {
      getRandomGameWithWordwrap(games)
    }
    else {
      throw err
    }
  })
}

function getFontInfoForGame(game) {
  return fsp.readFile('games/' + game + '/' + game + '.json')
  .then(parseJsonAsync)
  .then(json => [game, json]);
}

fsp.readdir('games').then(games => getGame(argv, games)).then( ([game, fontInfo]) => {
  const loadImagePromise = loadImage('games/' + game + '/' + game + '-blank.png')
  const fontImagePromise = loadImage('games/' + game + '/' + game + '-font.png')

  Promise.all([loadImagePromise, fontImagePromise]).then((values) => {
    var baseImage = values[0]
    var fontImage = values[1]
    const selectedOptions = getSelectedOptions(argv)
    const options = buildOptions(selectedOptions, fontInfo)
    const imageCanvas = generateImage(text, options, fontInfo, baseImage, fontImage)
    //fsp.writeFile('test.png', imageCanvas.toBuffer())

    const client = new Client();
    client.on('ready', () => {
      const channel = client.channels.cache.get('666555950873706496')
      const attachment = new MessageAttachment(imageCanvas.toBuffer(), 'test.png');
      channel.send('', attachment)
      client.destroy()
    })
    client.login(process.env.BOT_TOKEN)
  })
})


function getSelectedOptions(argv) {
  const selectedOptions = Object.assign({}, argv)
  delete selectedOptions._
  delete selectedOptions.$0
  delete selectedOptions.g
  return selectedOptions
}

function getValidGameOptions(fontInfo) {
  if ('overlays' in fontInfo) {
    const toOptionsObject = ([overlayName, overlayInfo], i) => {
      console.log(overlayName)
      console.log(overlayInfo)
      return [overlayName, Object.keys(overlayInfo['options'])]
    }
    return Object.fromEntries(Object.entries(fontInfo['overlays']).map(toOptionsObject))
  }
  else {
    return {}
  }
}

function buildOptions(argv, fontInfo) {
  const unselectedOptions = randomizeUnselectedOptions(Object.keys(argv), getValidGameOptions(fontInfo))
  return { ...argv, ...unselectedOptions }
}

function randomizeUnselectedOptions(providedOptions, options) {
  const unselectedOptions = Object.keys(options).filter(x => !providedOptions.includes(x));
  return Object.fromEntries(unselectedOptions.map(option => selectRandomOption(option, options)))
}

function selectRandomOption(option, options) {
  const optionEntries = options[option]
  return [option, optionEntries[Math.floor(Math.random() * optionEntries.length)]]
}

function generateImage() {

}

function generateImage(text, options, fontInfo, baseImage, fontImage) {
  const canvas = createCanvas(1000, 1000)
  renderText(canvas, fontInfo, baseImage, fontImage, text, options, false)
  return canvas
}