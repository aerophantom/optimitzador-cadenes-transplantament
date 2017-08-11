/**
 * Constructor d'objectes de tipus optimitzador de transplants que encapsula la funcionalitat per generar les cadenes
 * de transplants optimitzades.
 *
 * @param {{Object}} dades
 * @returns {{buildChain: buildChain}}
 * @constructor
 */
var OptimitzadorTransplants = function (dades) {


    /* ================================================================================================================
     *
     * Aquesta secció correspon a la funcionalitat de l'aplicació.
     *
     * ================================================================================================================ */
    var loadedData = dades; // Dades carregades a la memòria
    var R; // Conjunt de receptors
    var D; // Conjunt de donants
    var diccionariDonantsAssociats; // Relació dels donants associats a cada receptor per optimitzar la cerca inversa
    var llistatDonantsIgnorats;
    var llistatReceptorsIgnorats;
    var ignorarProbFallada = false;


    /**
     * Inicialitza els receptors creant una copia del contingut de la memoria i eliminant els receptors passats com argument.
     *
     * @param {Array} ignoreReceptors - Array de receptors a ignorar
     * @private
     */
    function inicialitzarReceptors(ignoreReceptors, ignoreDonors) {
        R = JSON.parse(JSON.stringify(loadedData.patients));

        if (ignoreReceptors) {
            for (var i = 0; i < ignoreReceptors.length; i++) {
                llistatReceptorsIgnorats.push(ignoreReceptors[i]);
                delete R[ignoreReceptors[i]];
            }
        }

        diccionariDonantsAssociats = {};

        if (!ignoreDonors) {
            return;
        }

        for (var receptorId in R) {
            for (var i = 0; i < R[receptorId].related_donors.length; i++) {
                if (ignoreDonors.indexOf(R[receptorId].related_donors[i]) !== -1) {
                    llistatDonantsIgnorats.push(R[receptorId].related_donors[i]);
                    continue;
                }
                diccionariDonantsAssociats[R[receptorId].related_donors[i]] = receptorId;
            }
        }

        console.log("Diccionari de donants associats", diccionariDonantsAssociats);


    }

    /**
     *
     * Inicialitza el llistat de donants, a partir dels donants compatibles de la llista de receptors, tenint en compte la
     * llista de donants ignorats.
     *
     * Els receptors associats als donants ignorats són exclosos del llistat de receptors.
     *
     * @param {Array} ignoreDonors - Array de donants a ignorar
     * @private
     */
    function inicialitzarDonants(ignoreDonors) {

        D = {};

        if (ignoreDonors) {
            for (var i = 0; i < ignoreDonors.length; i++) {
                var receptorAssociat = obtenirReceptorAssociat(ignoreDonors[i]);

                if (receptorAssociat) {
                    // Eliminem el donant associat del receptor
                    var donantsAssociatsAlReceptor = R[receptorAssociat].related_donors;
                    var index = donantsAssociatsAlReceptor.indexOf(ignoreDonors[i]);
                    donantsAssociatsAlReceptor.splice(index, 1);
                    llistatDonantsIgnorats.push(ignoreDonors[i]);

                    // Si no hi ha cap donant associat al receptor s'elimina de la llista de receptors
                    if (donantsAssociatsAlReceptor.length === 0) {
                        llistatReceptorsIgnorats.push(receptorAssociat);
                        delete R[receptorAssociat];
                        console.log("No queda cap donant associat a ", receptorAssociat);
                    }
                }
            }

        }


        for (var receptorId in R) {
            var donantsCompatibles = R[receptorId].compatible_donors;

            for (var i = 0; i < donantsCompatibles.length; i++) {
                var donant = donantsCompatibles[i];

                if (ignoreDonors && ignoreDonors.indexOf(donant.donor) !== -1) { // No s'afegeixen els donants ignorats
                    continue;
                }

                if (!D[donant.donor]) {
                    D[donant.donor] = {};
                }

                D[donant.donor][receptorId] = donant;
            }

        }



    }


    /**
     * Retorna el id del receptor associat al donant passat com argument.
     *
     * @param {number} donorId - id del donant del que es vol obtenir el receptor associat
     * @returns {number} - id del receptor associat
     * @private
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
     * @private
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
     * @param {Object} parell - tupla que conté la informació d'un donant i un receptor.
     * @returns {Object} - diccionari de dades amb els receptors compatibles amb el donant associat.
     * @private
     */
    function succMultipleDonors(parell) {
        var donantsAssociats = loadedData.patients[parell.receptor].related_donors;
        var successors = [];

        for (var i = 0; i < donantsAssociats.length; i++) {

            if (llistatDonantsIgnorats.indexOf(donantsAssociats[i] + "") !== -1) {
                console.error(donantsAssociats[i], "es troba a la llista de donants ignorats");
                continue;
            }


            var auxSuccessors = succDonant(donantsAssociats[i]);

            for (var j = 0; j < auxSuccessors.length; j++) {
                successors.push({
                    receptor: auxSuccessors[j],
                    donant: donantsAssociats[i]
                })
            }
        }

        return successors;
    }

    /**
     * Retorna un diccionari de dades amb els receptors compatibles amb el donant passat com argument.
     *
     * @param {int} donantId - identificador del donant
     * @returns {Object} - diccionari de dades amb els receptors compatibles amb el donant.
     * @private
     */
    function succDonantMultipleDonors(donantId) {
        var successors = [];

        if (llistatDonantsIgnorats.indexOf(donantId) !== -1) {
            return [];
        }

        var auxSuccessors = succDonant(donantId);

        for (var j = 0; j < auxSuccessors.length; j++) {
            successors.push({
                receptor: auxSuccessors[j],
                donant: donantId
            })
        }


        return successors;
    }


    /**
     * Retorna un diccionari de dades amb els receptors compatibles amb el donant corresponent al id passat com argument.
     *
     * @param {number} donantId - id del donant
     * @returns {Object} - diccionari de dades amb els receptors compatibles amb el donant.
     * @private
     */
    function succDonant(donantId) {

        if (donantId === -1 || !D[donantId]) {
            return {};
        }
        return Object.keys(D[donantId]);
    }

    /**
     * Retorna la probabilitat d'èxit d'un transplant entre el donant i el receptor passats com argument.
     *
     * @param {number} donantId - id del donant
     * @param {number} receptorId - id del receptor
     * @returns {number} - probabilitat d'èxit del transplantament
     * @private
     */
    function spDonant(donantId, receptorId) {
        if (ignorarProbFallada) {
            return 1;
        } else {
            return 1 - D[donantId][receptorId].failure_prob;
        }
    }


    /**
     * Retorna la puntuació de transplant entre el parell donant-receptor
     *
     * @param {Object} parell - tupla que conté la informació d'un donant i un receptor
     * @returns {number} - puntuació del transplant
     * @private
     */
    function scoreMultipleDonors(parell) {
        return scoreDonant(parell.donant, parell.receptor)
    }


    /**
     * Retorna la puntuació de transplant entre el donant i el receptor passats com argument.
     *
     * @param {number} donant - id del donant
     * @param {number} receptor - id del receptor
     * @returns {number} - puntuació del transplant
     * @private
     */
    function scoreDonant(donant, receptor) {
        var puntuacio;

        if (!D[donant][receptor]) {
            console.error("El receptor [" + receptor + "]no és compatible amb el donant [" + donant + "]");
        } else {
            puntuacio = D[donant][receptor].score;
        }

        return puntuacio;
    }


    /**
     * Funció auxiliar per eliminar múltiples elements d'un conjunt de donants.
     *
     * @param {Array} conjuntA - array del que s'eliminaran els elements
     * @param {Array} conjuntB - elements a eliminar
     * @private
     */
    function eliminarElementsDelConjuntMultipleDonors(conjuntA, conjuntB) {
        var nouConjunt = [];
        var eliminar = false;

        for (var i = 0; i < conjuntA.length; i++) {
            eliminar = false;
            for (var j=0; j< conjuntB.length; j++) {
                if (conjuntA[i].receptor == conjuntB[j]) {
                    eliminar = true;
                }
            }

            if (!eliminar) {
                nouConjunt.push(conjuntA[i]);
            }
        }

        return nouConjunt;
    }


    /**
     * Crea un array ordenat de tuples amb la informació corresponent als arrays passats per argument ordenat per
     * val.
     *
     * @param {Array} S - array amb les dades a ordenar
     * @param {Array} val - array de valors corresponents a S
     * @returns {Array} - array de tuples amb la informació passada per paràmetres ordenada incrementalment
     * @private
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
    function ExpUtMultipleDonors(rec, rec_list, depth) {
        var S = succMultipleDonors(rec); // S es el llistat de receptors successors com a tupla a la que s'ha afegit la dada "donant_candidat"

        S = eliminarElementsDelConjuntMultipleDonors(S, rec_list);
        rec_list = rec_list.slice();


        // Aquesta es la condició que finalitza la recursió
        if (S.length === 0 || depth === 0) {
            return 0;
        } else {
            var val = [];

            var receptor = isNaN(rec) ? rec.receptor : rec;
            for (var i = 0; i < S.length; i++) {
                var s = S[i];

                if (rec_list.indexOf(receptor) === -1) {
                    rec_list.push(receptor); // [rec | rec_list]
                }

                val.push(ExpUtMultipleDonors(s, rec_list, depth - 1) + scoreMultipleDonors(s)); // Només cal passar el receptor perque inclour la referència al donant candidat
            }
        }

        var T = obtenirConjuntOrdenatPerValor(S, val); // llista d'elements de S ordenats incrementalment pel seu val.
        var resultat = sumatoriProbabilitatsMultipleDonants(T);
        return resultat;
    }


    /**
     * Sumatori dels valors segons l'algorisme (transparència 38).
     *
     * @param {Array} T - array de tuples que conté la informació sobre els successors (receptors compatibles amb el donant
     * associat al receptor) i el valor calculat corresponent
     * @returns {number} - valor calculat
     * @private
     */
    function sumatoriProbabilitatsMultipleDonants(T) {
        var sumatori = 0;

        for (var i = 0; i < T.length; i++) {
            sumatori += spDonant(T[i].receptor.donant, T[i].receptor.receptor) * T[i].valor * productoriProbabilitatMultipleDonants(i, T); // Alerta, en la formula es val(ti), estan coordinados por el indice (val[i] corresponde al valor de T[i]
        }

        return sumatori;
    }


    /**
     * Productori dels valors segons l'algorisme (transparència 32).
     *
     * @param {number} i -  index a partir del qual es comença a iterar.
     * @param {Array} T - array de tuples que conté la informació sobre els successors (receptors compatibles amb el donant
     * associat al receptor) i el valor calculat corresponent
     * @returns {number} - valor calculat
     * @private
     */
    function productoriProbabilitatMultipleDonants(i, T) {
        var productori = 1;

        // En cas de que s'ignori la probabilitat de fallada s'ignora el càlcul
        if (ignorarProbFallada) {
            return productori;
        }

        for (var j=0; j<i; j++) {
            productori *= (1 - spDonant(T[j].receptor.donant, T[j].receptor.receptor));
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
     * @public
     */
    function buildChain(depth, altruist, ignoreDonors, ignoreReceptors, resultatsProvaEncreuada) {
        var current = altruist;
        var no_more_transplantations;
        var cadenaTransplants = [];

        llistatDonantsIgnorats = [];
        llistatReceptorsIgnorats = [];

        inicialitzarReceptors(ignoreReceptors, ignoreDonors);
        inicialitzarDonants(ignoreDonors);


        do {
            var S;
            if (current === altruist) {
                S = succDonantMultipleDonors(altruist);
            } else {
                S = succMultipleDonors(current);
            }

            var val = [];

            for (var i = 0; i < S.length; i++) {
                val.push(ExpUtMultipleDonors(S[i], [], depth) + scoreMultipleDonors(S[i]));
            }

            var T = obtenirConjuntOrdenatPerValor(S, val); // llista d'elements de S ordenats incrementalment pel seu val.
            no_more_transplantations = true;

            for (i = 0; i < T.length; i++) {
                var donant = current === altruist ? altruist : T[i].receptor.donant;
                var receptor = T[i].receptor.receptor;

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
     * @private
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
     * @private
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
     * @private
     */
    function eliminarDonant(donantId) {
        delete D[donantId];
    }

    /**
     * Elimina un receptor de la llista de receptors i els seus donants associats
     *
     * @param {number} receptorId - id del receptor
     * @private
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

    function getDonantsDeReceptor(receptorId) {
        return loadedData.patients[receptorId].related_donors;
    }

    function setIgnorarProbFallada(ignorar) {
        ignorarProbFallada = ignorar;
    }


    return {
        buildChain: buildChain,
        getDonantsDeReceptor: getDonantsDeReceptor,
        setIgnorarProbFallada: setIgnorarProbFallada
    };
};