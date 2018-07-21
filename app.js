var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
var Lib = require('./public/js/optimitzador-transplants.js');
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
/* ================================================================================================================
 * La documentació de l'API es pot trobar a: https://app.apiary.io/trasplantaments
 * Aquesta secció correspon a l'encaminament i accepta les següents rutes:
 *      /                           (GET)   → serveix l'index.html
 *      /upload                     (POST)  → puja el fitxer per processar i, si és correcte, retorna el resum en format JSON
 *
 *      Per executar codi al servidor:
 *      /cadena-trasplantaments     (POST)  → Crea l'objecte que optimitza la cadena de trasplants.
 *                                  (PUT)   → Obté la cadena de trasplantaments.
 * ================================================================================================================ */

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.post('/cadena-trasplantaments', function (req, res){
    // en aquesta crida rebem els fitxers JSON
    let form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(__dirname, '/uploads');

    form.on('error', function (err) {
        console.log('Error:: \n' + err);
    });

    form.parse(req, function(err, fields, files){
        let ids = [];
        if (Array.isArray(files["uploads[]"])){
            // Si es una llista llavors ha penjat multiples fitxers
            for(const f of files["uploads[]"]){
                ids.push(parseDataFile(f.path));
            }
        }
        else{
            // nomes ha penjat un fitxer
            ids.push(parseDataFile(files["uploads[]"].path));
        }
        let response = {
            "ids": ids
        };
        res.type('json');
        res.end(JSON.stringify(response));
    });
});

app.put('/cadena-trasplantaments', function (req, res){
    // aquesta crida ens demana que calculem la cadena optima
    let id = req.body.id;
    let depth = req.body.profunditat;
    let patient = req.body.pacient;
    let donantsIgnorats = req.body.donantsIgnorats;
    let receptorsIgnorats = req.body.receptorsIgnorats;
    let provesEncreuades = req.body.provesEncreuades;
    let ignorarFallada = req.body.ignorarFallada;

    if (donantsIgnorats.length === 0){
        donantsIgnorats = false;
    }
    if (receptorsIgnorats.length === 0){
        receptorsIgnorats = false;
    }
    if (provesEncreuades.length === 0){
        provesEncreuades = false;
    }

    let result = objects[id].buildChain(
        depth, patient, donantsIgnorats, receptorsIgnorats, provesEncreuades, ignorarFallada
    );
    let responseData = {
        status: "success",
        message: "chain calculated succesfully",
        trasplantaments: result
    };
    res.type('json');
    res.end(JSON.stringify(responseData));
});

app.get('/resum', function (req, res){
    let id = req.query.id;
    let responseData = objects[id].getSummary();
    res.type('json');
    res.end(JSON.stringify(responseData));
});

var objects = {}; // Dades carregades a la memòria
/**
 * Analitza el fitxer localitzat a la ruta especificada carregant les dades a memòria i seguidament l'esborra.
 *
 * @param ruta - ruta del fitxer que es vol analitzar
 * @returns {boolean} - cert si s'ha parsejat amb èxit
 */
function parseDataFile(ruta) {
    let id = undefined;
    try {
        let data = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        let object = new Lib.OptimitzadorTransplantsLib(data, true);
        id = object.hashCode();
        objects[id] = object;
    } catch (e) {
        console.error(e);
    }

    fs.unlink(ruta, function () {/* buida per evitar el warning */
    });

    return id;
}

/* ================================================================================================================
 *
 * Aquesta secció inicia l'aplicació com a servidor HTTP.
 *
 * ================================================================================================================ */
var port = 80;
var server = app.listen(port, function () {
    console.log('Servidor escoltant al port ' + port);
});
