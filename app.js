var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
var Lib = require('./public/js/optimitzador-transplants.js');
var OptimitzadorTransplants;
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
    // en aquesta crida rebem el fitxer JSON
    let form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(__dirname, '/uploads');

    // every time a file has been uploaded successfully,
    // rename it to it's orignal name
    // form.on('file', function (field, file) {
    //     let filepath = path.join(form.uploadDir, file.name);
    //     fs.rename(file.path, filepath, function () {
    //         ids.push(parseDataFile(filepath));
    //         console.log("--->", ids);
    //     });
    // });

    form.on('error', function (err) {
        console.log('Error:: \n' + err);
    });

    form.parse(req, function(err, fields, files){
        //TODO mirar como se hace para cargar multiples
        console.log("--->", files["uploads[]"].path);
        let ids = [];
        ids.push(parseDataFile(files["uploads[]"].path));
        console.log("--->", ids);
        let response = {
            "ids": ids
        };
        res.type('json');
        res.end(JSON.stringify(response));
    });
});

app.put('/cadena-trasplantaments', function (req, res){
    // aquesta crida ens demana que calculem la cadena optima
    OptimitzadorTransplants = new Lib.OptimitzadorTransplantsLib(loadedData, true);

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

    let result = OptimitzadorTransplants.buildChain(
        depth, patient, donantsIgnorats, receptorsIgnorats, provesEncreuades, ignorarFallada
    );
    let responseData = {
        status: "success",
        message: "chain calculated succesfully",
        trasplantaments: result
    };
    console.log(result);
    res.type('json');
    res.end(JSON.stringify(responseData));
});

app.get('/resum', function (req, res){
    let id = req.query.id;
    console.log(id);
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
        objects.filename = path.basename(ruta);
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
