function evalHook(hook, options) {
    return translateOverlayOptions(hook, options)
}   

function translateOverlayOptions(hook, options) {
    const overlayValueRegex = /\$\('#overlay-(\w*) \S*'\).text\(\)/g
    const result = hook.split(overlayValueRegex)
    if (result.length == 1) {
        return hook;
    }
    else {
        var i,j
        var newstr = ''
        for (i=0,j=result.length; i<j-1; i+=2) {
            temparray = result.slice(i,i+2);
            newstr += result[i]
            newstr += "'" + options[result[i+1]] + "'"
            console.log(temparray)
        }
        newstr += result[i]
        return newstr;
    }
}

exports.evalHook = evalHook