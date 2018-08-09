class Utils{
    static get currentDateTime() {
        let now     = new Date();
        let year    = now.getFullYear();
        let month   = now.getMonth()+1;
        let day     = now.getDate();
        let hour    = now.getHours();
        let minute  = now.getMinutes();
        let second  = now.getSeconds();
        if(month.toString().length === 1) {
            month = '0'+month;
        }
        if(day.toString().length === 1) {
            day = '0'+day;
        }
        if(hour.toString().length === 1) {
            hour = '0'+hour;
        }
        if(minute.toString().length === 1) {
            minute = '0'+minute;
        }
        if(second.toString().length === 1) {
            second = '0'+second;
        }
        return year+'/'+month+'/'+day+' '+hour+':'+minute+':'+second;
    }

}

String.prototype.format = function() {
    // https://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
    // estaria de puta madre indicar como furula esta, es un reduce.
    // mas info: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce
    return [...arguments].reduce((p,c) => p.replace(/{}/,c), this);
};

// String.prototype.hashCode() = function()
//TODO estaria be fer un Utils.js Podria afegir la funcio que genera el
// hashcode