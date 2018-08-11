/**
 * Class that contains useful functions.
 */
class Utils{

    /**
     * Obtains the current datetime MySQL formatted.
     *
     * More information:
     * https://stackoverflow.com/questions/10211145/getting-current-date-and-time-in-javascript
     *
     * @returns {string}
     * @public
     */
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

/**
 * Obtains a formatted string. All the '{}' occurrences are replaced by
 * the parameters passed by.
 *
 * For example: "This {} was retrieved from {}.".format("code", "StackOverflow")
 * will return: "This code was retrieved from StackOverflow".
 *
 * More information:
 * https://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
 *
 * @returns {string} - formatted string.
 */
String.prototype.format = function() {
    return [...arguments].reduce((p,c) => p.replace(/{}/,c), this);
};

/**
 * Obtains the string's hash code. Based on the same function on Java.
 *
 * More information:
 * https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
 *
 * @returns {number}
 */
String.prototype.hashCode = function() {
    var hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};
