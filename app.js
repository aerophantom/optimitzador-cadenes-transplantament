var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));

/* ================================================================================================================
 *
 * Aquesta secció correspon a l'encaminament i accepta les següents rutes:
 *      / (GET)                 - serveix l'index.html
 *      /autoload (GET)         - retorna la informació del contingut de memoria en format JSON
 *      /upload (POST)          - puja el fitxer per processar i, si és correcte, retorna el resum en format JSON
 *      /get-chains (GET)       - retorna la cadena de transplantament optimitzada segons els paràmetres passats en format JSON
 *
 * ================================================================================================================ */
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});


app.get('/autoload', function (req, res) {
    var responseData;


    if (loadedData) {
        // S'ha trobat informació a la memòria
        responseData = {
            status: "success",
            summary: {
                origin: loadedData.origin,
                description: loadedData.description ? loadedData.description : 'No s\'ha trobat cap descripció',
                altruists: loadedData.altruists,
                dadesTimestamp: dadesTimeStamp
            }
        };
    } else {
        // No s'ha pujat cap fitxer encara

        responseData = {
            status: "error",
            message: "No s'ha pujat cap fitxer anteriorment"
        };

    }

    res.type('json');
    res.end(JSON.stringify(responseData));
});

app.get('/get-chains', function (req, res) {
    var responseData;

    if (req.query.dadesTimestamp == dadesTimeStamp && loadedData) {
        responseData = {
            status: "success",
            chains: buildChain(req.query.depth, req.query.id, req.query.ignoraDonants, req.query.ignoraReceptors, req.query.resultatsProvaEncreuada)
        };

    } else {


        if (loadedData) {
            responseData = {
                status: "error",
                message: "El fitxer carregat al servidor ha canviat. S'han recarregat les dades.",
                summary: {
                    origin: loadedData.origin,
                    description: loadedData.description ? loadedData.description : 'No s\'ha trobat cap descripció',
                    altruists: loadedData.altruists,
                    dadesTimestamp: dadesTimeStamp
                }
            }
        } else {
            responseData = {
                status: "error",
                message: "No s'han trobat dades al servidor. Cal pujar un nou fitxer."
            }
        }
    }

    res.type('json');
    res.end(JSON.stringify(responseData));
});

app.post('/upload', function (req, res) {
    var form = new formidable.IncomingForm();

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(__dirname, '/uploads');

    // every time a file has been uploaded successfully,
    // rename it to it's orignal name
    form.on('file', function (field, file) {
        var filepath = path.join(form.uploadDir, file.name);
        fs.rename(file.path, filepath, function () {

            var responseData;

            if (parseDataFile(filepath)) {
                responseData = {
                    status: "success",
                    summary: {
                        origin: loadedData.origin,
                        description: loadedData.description ? loadedData.description : 'No s\'ha trobat cap descripció',
                        altruists: loadedData.altruists,
                        dadesTimestamp: dadesTimeStamp
                    }
                };
            } else {
                // S'ha produit un error
                responseData = {
                    status: "error",
                    message: "No s'ha pogut processar el fitxer correctament"
                };

            }


            res.type('json');
            res.end(JSON.stringify(responseData));
        });


    });

    form.on('error', function (err) {
        console.log('Error:: \n' + err);
    });

    form.parse(req);
});


/* ================================================================================================================
 *
 * Aquesta secció correspon a la funcionalitat de l'aplicació.
 *
 * ================================================================================================================ */
var dadesTimeStamp; // Data en la que s'ha actualitzat la memoria
var loadedData = null; // Dades carregades a la memòria
var R; // Conjunt de receptors
var D; // Conjunt de donants
var diccionariDonantsAssociats; // Relació dels donants associats a cada receptor per optimitzar la cerca inversa

/**
 * Analitza el fitxer localitzat a la ruta especificada carregant les dades a memòria i seguidament l'esborra.
 *
 * @param ruta - ruta del fitxer que es vol analitzar
 * @returns {boolean} - cert si s'ha parsejat amb èxit
 */
function parseDataFile(ruta) {
    var esCorrecte = false;

    try {
        loadedData = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        esCorrecte = true;
        dadesTimeStamp = Date.now();
    } catch (e) {
        console.error(e);
    }

    fs.unlink(ruta, function () {/* buida per evitar el warning */});

    return esCorrecte;
}

/**
 * Inicialitza els receptors creant una copia del contingut de la memoria i eliminant els receptors passats com argument.
 *
 * @param {Array} ignoreReceptors - Array de receptors a ignorar
 */
function inicialitzarReceptors(ignoreReceptors) {
    R = JSON.parse(JSON.stringify(loadedData.patients));

    if (ignoreReceptors) {
        for (var i = 0; i < ignoreReceptors.length; i++) {
            delete R[ignoreReceptors[i]];
        }
    }
}

/**
 *
 * Inicialitza el llistat de donants, a partir dels donants compatibles de la llista de receptors, tenint en compte la
 * llista de donants ignorats.
 *
 * Els receptors associats als donants ignorats són exclosos del llistat de receptors.
 *
 * @param {Array} ignoreDonors - Array de donants a ignorar
 */
function inicialitzarDonants(ignoreDonors) {
    if (ignoreDonors) {
        for (var i = 0; i < ignoreDonors.length; i++) {
            var receptorAssociat = obtenirReceptorAssociat(ignoreDonors[i]);
            delete R[receptorAssociat];
        }
    }

    D = {};
    diccionariDonantsAssociats = {};
    for (var receptorId in R) {
        var donantsCompatibles = R[receptorId].compatible_donors;

        for (var i = 0; i < donantsCompatibles.length; i++) {
            var donant = donantsCompatibles[i];

            if (ignoreDonors && ignoreDonors.indexOf(donant) !== -1) { // No s'afegeixen els donants ignorats
                continue;
            }

            if (!D[donant.donor]) {
                D[donant.donor] = {};
            }

            D[donant.donor][receptorId] = donant;
        }

        for (var j = 0; j < R[receptorId].related_donors.length; j++) {
            diccionariDonantsAssociats[R[receptorId].related_donors[j]] = receptorId;
        }
    }
}


/**
 * Retorna el id del receptor associat al donant passat com argument.
 *
 * @param {number} donorId - id del donant del que es vol obtenir el receptor associat
 * @returns {number} - id del receptor associat
 */
function obtenirReceptorAssociat(donorId) {
    return diccionariDonantsAssociats[donorId];
}


/**
 * Retorna el id del donant associat al receptor passat com argument. En cas de que no es trobi a l'array de receptors
 * actuals es consultan les dades a la memoria de l'aplicació.
 *
 * @param {number} receptorId - id del receptor
 * @returns {number} - id del donant associat
 */
function d(receptorId) {
    if (!R[receptorId]) {
        return loadedData.patients[receptorId].related_donors[0];
    }

    return R[receptorId].related_donors[0];
}

/**
 * Retorna un diccionari de dades amb els receptors compatibles amb el donant associat al receptor passat com argument.
 *
 * @param {number} receptorId - id del receptor
 * @returns {Object} - diccionari de dades amb els receptors compatibles amb el donant associat.
 */
function succ(receptorId) {
    var donantAssociatId = d(receptorId);
    return succDonant(donantAssociatId);
}


/**
 * Retorna un diccionari de dades amb els receptors compatibles amb el donant corresponent al id passat com argument.
 *
 * @param {number} donantId - id del donant
 * @returns {Object} - diccionari de dades amb els receptors compatibles amb el donant.
 */
function succDonant(donantId) {

    if (donantId === -1 || !D[donantId]) {
        return {};
    }
    return Object.keys(D[donantId]);
}

/**
 * Retorna la probabilitat d'èxit d'un transplant del donant associat al receptorI cap al receptorJ
 *
 * @param {number} receptorI - id del receptor que proporciona el donant
 * @param {number} receptorJ - id del receptor que rep la donació
 * @returns {number} - probabilitat d'èxit del transplantament
 */
function sp(receptorI, receptorJ) {
    var idDonantAssociat = d(receptorI);
    var probabilitatExit = 0;

    if (!D[idDonantAssociat][receptorJ]) {
        console.error("El receptor [" + receptorJ + "]no és compatible amb el donant associat a [" + receptorI + "]");
    } else {
        probabilitatExit = spDonant(idDonantAssociat, receptorJ);
    }

    return probabilitatExit;
}

/**
 * Retorna la probabilitat d'èxit d'un transplant entre el donant i el receptor passats com argument.
 *
 * @param {number} donantId - id del donant
 * @param {number} receptorId - id del receptor
 * @returns {number} - probabilitat d'èxit del transplantament
 */
function spDonant(donantId, receptorId) {
    return 1 - D[donantId][receptorId].failure_prob;
}

/**
 * Retorna la puntuació de transplant entre el donant associat al receptorI i el receptorJ.
 *
 * @param {number} receptorI - id del receptorI
 * @param {number} receptorJ - id del receptorJ
 * @returns {number} - puntuació del transplant
 */
function score(receptorI, receptorJ) {
    var idDonantAssociat = d(receptorI);
    return scoreDonant(idDonantAssociat, receptorJ);
}


/**
 * Retorna la puntuació de transplant entre el donant i el receptor passats com argument.
 *
 * @param {number} donant - id del donant
 * @param {number} receptor - id del receptor
 * @returns {number} - puntuació del transplant
 */
function scoreDonant(donant, receptor) {
    // console.log("#scoreDonant", receptorJ);
    var puntuacio;

    if (!D[donant][receptor]) {
        console.error("El receptor [" + receptor + "]no és compatible amb el donant [" + donant + "]");
    } else {
        puntuacio = D[donant][receptor].score;
    }

    return puntuacio;
}


/**
 * Funció auxiliar per eliminar múltiples elements d'un array
 *
 * @param {Array} conjuntA - array del que s'eliminaran els elements
 * @param {Array} conjuntB - elements a eliminar
 */
function eliminarElementsDelConjunt(conjuntA, conjuntB) {
    for (var i = 0; i < conjuntB.length; i++) {
        eliminarElementDelConjunt(conjuntA, conjuntB[i]);
    }
}

/**
 * Funció auxiliar per eliminar un element d'un conjunt, ja es tracti d'un array o un diccionari de dades.
 *
 * @param {Array|Object} conjunt - conjunt del que s'eliminarà l'element
 * @param {*} element - element a eliminar del conjunt
 */
function eliminarElementDelConjunt(conjunt, element) {

    if (Array.isArray(conjunt)) {
        var index = conjunt.indexOf(element);
        if (index !== -1) {
            conjunt.splice(index, 1);
        }
    } else {
        delete(conjunt[element]);
    }

}

// Retorna un nou conjunt amb els elements de l'array S ordenats pel seu valor corresponent
// En lloc de retornar el conjunt de receptors es retorna el conjunt de tuples receptor-valor,
// ja que aquests han d'estar lligats


/**
 * Crea un array ordenat de tuples amb la informació corresponent als arrays passats per argument ordenat per
 * val
 *
 * @param {Array} S - array amb les dades a ordenar
 * @param {Array} val - array de valors corresponents a S
 * @returns {Array} - array de tuples amb la informació passada per paràmetres ordenada incrementalment
 */
function obtenirConjuntOrdenatPerValor(S, val) {
    var T = [];

    for (var i = 0; i < S.length; i++) {
        T.push({
            receptor: S[i],
            valor: val[i]
        });
    }

    T.sort(function (a, b) {
        return a.valor - b.valor;
    });

    return T;
}


/**
 * Retorna la puntuació acumulada esperada a obtenir de la cadena originada a rec que no inclu cap receptor de rec_list.
 * La funció només explora els primers nivells de profunditat (a partir de rec)
 *
 * @param {number} rec - id del receptor
 * @param {Array} rec_list - array amb els id dels elements a ignorar (els receptors processats anteriorment)
 * @param {number} depth - profunditat a explorar.
 */
function ExpUt(rec, rec_list, depth) {
    var S = succ(rec);
    eliminarElementsDelConjunt(S, rec_list);

    // Aquesta es la condició que finalitza la recursió
    if (S.length === 0 || depth === 0) {
        return 0;
    } else {
        var val = [];

        for (var i = 0; i < S.length; i++) {
            var s = S[i];

            if (rec_list.indexOf(rec) === -1) {
                rec_list.push(rec); // [rec | rec_list]
            }

            val.push(ExpUt(s, rec_list, depth - 1) + score(rec, s));

        }
    }

    var T = obtenirConjuntOrdenatPerValor(S, val); // llista d'elements de S ordenats incrementalment pel seu val.
    var resultat = sumatoriProbabilitats(rec, T);
    return resultat;
}

/**
 * Sumatori dels valors segons l'algorisme (transparència 32).
 *
 * @param {number} rec - id del receptor
 * @param {Array} T - array de tuples que conté la informació sobre els successors (receptors compatibles amb el donant
 * associat al receptor) i el valor calculat corresponent
 * @returns {number} - valor calculat
 */
function sumatoriProbabilitats(rec, T) {
    var sumatori = 0;

    for (var i = 0; i < T.length; i++) {
        sumatori += sp(rec, T[i].receptor) * T[i].valor * productoriProbabilitat(i, rec, T); // Alerta, en la formula es val(ti), estan coordinados por el indice (val[i] corresponde al valor de T[i]
    }

    return sumatori;
}

/**
 * Productori dels valors segons l'algorisme (transparència 32).
 *
 * @param {number} i -  index a partir del qual es comença a iterar.
 * @param {number} rec - id del receptor
 * @param {Array} T - array de tuples que conté la informació sobre els successors (receptors compatibles amb el donant
 * associat al receptor) i el valor calculat corresponent
 * @returns {number} - valor calculat
 */
function productoriProbabilitat(i, rec, T) {
    var productori = 1;

    for (var j = i - 1; j > 0; j--) {
        productori *= (1 - sp(rec, T[j].receptor));
    }

    return productori;
}

/**
 * Genera una cadena de transplantament optimitzada a partir d'un donant altruista tenint en compte la profunditat
 * màxima a explorar, els donants i receptors a ignorar i els resultats de les proves encreuades.
 *
 * @param {number} depth - profunditat màxima a explorar
 * @param {number} altruist - id del donant altruista que inicia la cadena
 * @param {Array} ignoreDonors - array de id de donants a ignorar
 * @param {Array} ignoreReceptors - array de id de receptors a ignorar
 * @param resultatsProvaEncreuada - array de cadenes de text amb les parelles de la prova encreuada que han donat positiu
 * @returns {Array} - array de tuples amb les dades de transplantament.
 */
function buildChain(depth, altruist, ignoreDonors, ignoreReceptors, resultatsProvaEncreuada) {
    var current = altruist;
    var no_more_transplantations;
    var cadenaTransplants = [];

    inicialitzarReceptors(ignoreReceptors);
    inicialitzarDonants(ignoreDonors);

    do {
        var S;
        if (current === altruist) {
            S = succDonant(altruist);
        } else {
            S = succ(current);
        }

        var val = [];

        for (var i = 0; i < S.length; i++) {
            if (current === altruist) {
                val.push(ExpUt(S[i], [], depth) + scoreDonant(altruist, S[i]));
            } else {
                val.push(ExpUt(S[i], [], depth) + score(current, S[i]));
            }
        }

        var T = obtenirConjuntOrdenatPerValor(S, val); // llista d'elements de S ordenats incrementalment pel seu val.
        no_more_transplantations = true;

        for (i = 0; i < T.length; i++) {
            var donant = current === altruist ? altruist : d(current);
            var receptor = T[i].receptor;

            if (provaEncreuada(resultatsProvaEncreuada, donant, receptor)) {
                // Si el resultat de la prova es positiu no es pot fer el transplant

                eliminarDonantCompatibleDeReceptor(donant, receptor);
                continue;
            } else {
                var dadesTransplant = {
                    receptor: receptor,
                    donant: donant,
                    probExit: spDonant(donant, receptor),
                    valor: T[i].valor
                };

                cadenaTransplants.push(dadesTransplant);
                eliminarDonant(dadesTransplant.donant);
                eliminarReceptor(dadesTransplant.receptor);
                current = T[i].receptor;
                no_more_transplantations = false;
            }

            break;
        }

    } while (!no_more_transplantations);

    return cadenaTransplants;
}


/**
 * Retorna el resultat de la prova encreuada pel donant i receptor passats com argument.
 *
 * @param {Array} resultatsProva - array amb els resultats de les proves encreuades
 * @param {number} donant - id del donant
 * @param {number} receptor - id del receptor
 * @returns {boolean} - Cert si la prova es positiva o fals en cas contrari
 */
function provaEncreuada(resultatsProva, donant, receptor) {
    if (!resultatsProva || !donant || !receptor) {
        return false;
    } else {
        return resultatsProva.indexOf(receptor + "-" + donant) !== -1;
    }
}

/**
 * Elimina un donant de la llista de donants compatibles d'un receptor.
 *
 * @param {number} donantId - ide del donant
 * @param {number} receptorId - id del receptor
 */
function eliminarDonantCompatibleDeReceptor(donantId, receptorId) {

    // Eliminem l'assocació del donant amb el receptor
    delete D[donantId][receptorId];

    // Eliminem el donant de la llista de donants compatibles del receptor
    var donantsCompatibles = R[receptorId].compatible_donors;
    var index = -1;

    for (var i = 0; i < donantsCompatibles.length; i++) {
        if (donantsCompatibles[i].donor === donantId) {
            index = i;
            break;
        }
    }

    if (index === -1) {
        console.log("Error, no s'ha trobat el donant associat " + donantId + " com a donant compatible de " + receptorId);
    } else {
        donantsCompatibles.splice(index, 1);
    }

}

/**
 * Elimina un donant de la llista de donants.
 *
 * @param {number} donantId - id del donant
 */
function eliminarDonant(donantId) {
    delete D[donantId];
}

/**
 * Elimina un receptor de la llista de receptors
 *
 * @param {number} receptorId - id del receptor
 */
function eliminarReceptor(receptorId) {
    var donantsCompatibles = R[receptorId].compatible_donors;

    for (var i = 0; i < donantsCompatibles.length; i++) {
        if (D[donantsCompatibles[i].donor]) {
            delete D[donantsCompatibles[i].donor][receptorId];
        }
    }

    if (D[d(receptorId)]) {
        delete D[d(receptorId)][receptorId];
    }

    delete R[receptorId];
}


/* ================================================================================================================
 *
 * Aquesta secció inicia l'aplicació com a servidor HTTP.
 *
 * ================================================================================================================ */
var port = 3000;
var server = app.listen(port, function () {
    console.log('Servidor escoltant al port ' + port);
});