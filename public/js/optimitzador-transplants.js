/**
 * Constructor d'objectes de tipus optimitzador de transplants que encapsula la funcionalitat per generar les cadenes
 * de trasplantaments optimitzades.
 *
 * @param {{Object}} dades
 * @returns {{buildChain: buildChain}}
 * @constructor
 */
var OptimitzadorTransplants = function (dades, descendent) {

    /* ================================================================================================================
     *
     * Aquesta secció correspon a la funcionalitat de l'aplicació.
     *
     * ================================================================================================================ */
    var loadedData = dades;         // Dades carregades a la memòria
    var R;                          // Conjunt de receptors
    var D;                          // Conjunt de donants
    var diccionariDonantsAssociats; // Relació dels donants associats a cada receptor per optimitzar la cerca inversa
    var llistatDonantsIgnorats;
    var llistatReceptorsIgnorats;
    var ignorarProbFallada = false;
    let hashCodeComputed = false;
    let log = {};

    /**
     * Inicialitza els receptors creant una còpia del contingut de la memòria i eliminant els receptors passats com
     * argument.
     *
     * @param {Array} ignoreReceptors - Array de receptors a ignorar
     * @param {Array} ignoreDonors - Array de donants a ignorar
     * @private
     */
    function inicialitzarReceptors(ignoreReceptors, ignoreDonors) {
        R = JSON.parse(JSON.stringify(loadedData.patients));

        if (ignoreReceptors) {
            for (let i = 0; i < ignoreReceptors.length; i++) {
                llistatReceptorsIgnorats.push(ignoreReceptors[i]);
                delete R[ignoreReceptors[i]];
            }
        }

        diccionariDonantsAssociats = {};

        for (let receptorId in R) {
            for (let i = 0; i < R[receptorId].related_donors.length; i++) {
                if (ignoreDonors && ignoreDonors.indexOf(R[receptorId].related_donors[i]) !== -1) {
                    llistatDonantsIgnorats.push(R[receptorId].related_donors[i]);
                    continue;
                }
                diccionariDonantsAssociats[R[receptorId].related_donors[i]] = receptorId;
            }
        }
    }

    /**
     *
     * Inicialitza el llistat de donants, a partir dels donants compatibles de la llista de receptors, tenint en compte
     * la llista de donants ignorats.
     *
     * Els receptors associats als donants ignorats són exclosos del llistat de receptors.
     *
     * @param {Array} ignoreDonors - Array de donants a ignorar
     * @private
     */
    function inicialitzarDonants(ignoreDonors) {
        D = {};

        if (ignoreDonors) {
            for (let i = 0; i < ignoreDonors.length; i++) {
                let receptorAssociat = obtenirReceptorAssociat(ignoreDonors[i]);

                if (receptorAssociat) {
                    // Eliminem el donant associat del receptor
                    let donantsAssociatsAlReceptor = R[receptorAssociat].related_donors;
                    let index = donantsAssociatsAlReceptor.indexOf(ignoreDonors[i]);
                    donantsAssociatsAlReceptor.splice(index, 1);
                    llistatDonantsIgnorats.push(ignoreDonors[i]);

                    // Si no hi ha cap donant associat al receptor, s'elimina de la llista de receptors
                    if (donantsAssociatsAlReceptor.length === 0) {
                        llistatReceptorsIgnorats.push(receptorAssociat);
                        delete R[receptorAssociat];
                        console.log("No queda cap donant associat a ", receptorAssociat);
                    }
                }
            }
        }
        for (let receptorId in R) {
            let donantsCompatibles = R[receptorId].compatible_donors;

            for (let i = 0; i < donantsCompatibles.length; i++) {
                let donant = donantsCompatibles[i];

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
     * @param {number} donorId - id del donant del què es vol obtenir el receptor associat
     * @returns {number} - id del receptor associat
     * @private
     */
    function obtenirReceptorAssociat(donorId) {
        return diccionariDonantsAssociats[donorId];
    }

    /**
     * Retorna un array de diccionari de dades amb els receptors compatibles amb el donant associat al receptor passat
     * com argument.
     *
     * @param {Object} parell - tupla que conté la informació d'un donant i un receptor.
     * @returns {Array} - array de tuples de dades amb els receptors compatibles amb el donant associat.
     * @private
     */
    function succMultipleDonors(parell) {
        let donantsAssociats = loadedData.patients[parell.receptor].related_donors;
        let successors = [];

        for (let i = 0; i < donantsAssociats.length; i++) {

            if (llistatDonantsIgnorats.indexOf(donantsAssociats[i] + "") !== -1) {
                continue;
            }
            let auxSuccessors = succDonant(donantsAssociats[i]);

            for (let j = 0; j < auxSuccessors.length; j++) {
                successors.push({
                    receptor: auxSuccessors[j],
                    donant: donantsAssociats[i]
                })
            }
        }
        return successors;
    }

    /**
     * Retorna un array de dades amb els receptors compatibles amb el donant passat com argument.
     *
     * @param {int} donantId - identificador del donant
     * @returns {Array} - array de dades amb els receptors compatibles amb el donant.
     * @private
     */
    function succDonantMultipleDonors(donantId) {
        let successors = [];

        if (llistatDonantsIgnorats.indexOf(donantId) === -1) {
            let auxSuccessors = succDonant(donantId);

            for (let j = 0; j < auxSuccessors.length; j++) {
                successors.push({
                    receptor: auxSuccessors[j],
                    donant: donantId
                })
            }
        }
        return successors;
    }

    /**
     * Retorna un array amb els identificadors dels receptors compatibles amb el donant corresponent al id passat com
     * argument.
     *
     * @param {number} donantId - id del donant
     * @returns {Array} - array amb els identificadors dels receptors compatibles amb el donant.
     * @private
     */
    function succDonant(donantId) {
        if (donantId === -1 || !D[donantId]) {
            return [];
        }
        return Object.keys(D[donantId]);
    }

    /**
     * Retorna la probabilitat d'èxit d'un trasplantament entre el donant i el receptor passats com argument.
     *
     * @param {number} donantId - id del donant
     * @param {number} receptorId - id del receptor
     * @returns {number} - probabilitat d'èxit del trasplantament
     * @private
     */
    function spDonant(donantId, receptorId) {
        let p = 1;
        if (!ignorarProbFallada) {
            p = 1 - D[donantId][receptorId].failure_prob;
        }
        return p;
    }

    /**
     * Retorna la puntuació de trasplantament entre el parell donant-receptor
     *
     * @param {Object} parell - tupla que conté la informació d'un donant i un receptor
     * @returns {number} - puntuació del trasplantament
     * @private
     */
    function scoreMultipleDonors(parell) {
        return scoreDonant(parell.donant, parell.receptor)
    }

    /**
     * Retorna la puntuació de trasplantament entre el donant i el receptor passats com argument.
     *
     * @param {number} donant - id del donant
     * @param {number} receptor - id del receptor
     * @returns {number} - puntuació del trasplantament
     * @private
     */
    function scoreDonant(donant, receptor) {
        let puntuacio;

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
        let nouConjunt = [];
        let eliminar = false;

        for (let i = 0; i < conjuntA.length; i++) {
            eliminar = false;
            for (let j=0; j< conjuntB.length; j++) {
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
        let T = [];

        for (let i = 0; i < S.length; i++) {
            T.push({
                receptor: S[i],
                valor: val[i]
            });
        }
        T.sort(function (a, b) {
            if (descendent) {
                return b.valor - a.valor;
            } else {
                return a.valor - b.valor;
            }
        });
        return T;
    }

    /**
     * Retorna la puntuació acumulada esperada a obtenir de la cadena originada a rec que no inclou cap receptor de
     * rec_list.
     * La funció només explora els primers nivells de profunditat (a partir de rec)
     *
     * @param {number} rec - id del receptor
     * @param {Array} rec_list - array amb els id dels elements a ignorar (els receptors processats anteriorment)
     * @param {number} depth - profunditat a explorar.
     */
    function ExpUtMultipleDonors(rec, rec_list, depth) {
        // S és el llistat de receptors successors com a tupla a la que s'ha afegit la dada "donant_candidat"
        let S = succMultipleDonors(rec);

        S = eliminarElementsDelConjuntMultipleDonors(S, rec_list);
        rec_list = rec_list.slice();


        // Aquesta és la condició que finalitza la recursió
        if (S.length === 0 || depth === 0) {
            return 0;
        } else {
            let val = [];

            let receptor = isNaN(rec) ? rec.receptor : rec;
            for (let i = 0; i < S.length; i++) {
                let s = S[i];

                if (rec_list.indexOf(receptor) === -1) {
                    rec_list.push(receptor); // [rec | rec_list]
                }

                val.push(ExpUtMultipleDonors(s, rec_list, depth - 1) + scoreMultipleDonors(s)); // Només cal passar el receptor perquè inclou la referència al donant candidat
            }
            let T = obtenirConjuntOrdenatPerValor(S, val); // Llista d'elements de S ordenats incrementalment pel seu val.
            return sumatoriProbabilitatsMultipleDonants(T);
        }
    }

    /**
     * Sumatori dels valors segons l'algorisme (transparència 38).
     *
     * @param {Array} T - array de tuples que conté la informació sobre els successors (receptors compatibles amb
     * el donant associat al receptor) i el valor calculat corresponent
     * @returns {number} - valor calculat
     * @private
     */
    function sumatoriProbabilitatsMultipleDonants(T) {
        let sumatori = 0;

        for (let i = 0; i < T.length; i++) {
            sumatori += spDonant(T[i].receptor.donant, T[i].receptor.receptor) * T[i].valor * productoriProbabilitatMultipleDonants(i, T); // Alerta, en la formula és val(ti), estan coordinats per l'índex (val[i] correspon al valor de T[i]
        }
        return sumatori;
    }

    /**
     * Productori dels valors segons l'algorisme (transparència 32).
     *
     * @param {number} i -  índex a partir del qual es comença a iterar.
     * @param {Array} T - array de tuples que conté la informació sobre els successors (receptors compatibles amb el
     * donant
     * associat al receptor) i el valor calculat corresponent
     * @returns {number} - valor calculat
     * @private
     */
    function productoriProbabilitatMultipleDonants(i, T) {
        let productori = 1;

        if (!ignorarProbFallada) {
            for (let j=0; j<i; j++) {
                productori *= (1 - spDonant(T[j].receptor.donant, T[j].receptor.receptor));
            }
        }
        return productori;
    }

    /**
     * Genera una cadena de trasplantament optimitzada a partir d'un donant altruista tenint en compte la profunditat
     * màxima a explorar, els donants i receptors a ignorar i els resultats de les proves encreuades.
     *
     * @param {number} depth - profunditat màxima a explorar
     * @param {number} altruist - id del donant altruista que inicia la cadena
     * @param {Array} ignoreDonors - array de id de donants a ignorar
     * @param {Array} ignoreReceptors - array de id de receptors a ignorar
     * @param {Array} resultatsProvaEncreuada - array de cadenes de text amb les parelles de la prova encreuada que han donat
     * positiu
     * @param {boolean} ignorarFallada - indica si es ignora la probabilitat de fallada.
     * @returns {Array} - array de tuples amb les dades de trasplantament.
     * @public
     */
    function buildChain(depth, altruist, ignoreDonors, ignoreReceptors, resultatsProvaEncreuada, ignorarFallada) {
        let current = altruist;
        let no_more_transplantations;
        let cadenaTransplants = [];

        llistatDonantsIgnorats = [];
        llistatReceptorsIgnorats = [];

        inicialitzarReceptors(ignoreReceptors, ignoreDonors);
        inicialitzarDonants(ignoreDonors);
        setIgnorarProbFallada(ignorarFallada);

        do {
            let S;
            if (current === altruist) {
                S = succDonantMultipleDonors(altruist);
            } else {
                S = succMultipleDonors(current);
            }

            let val = [];

            for (let i = 0; i < S.length; i++) {
                val.push(ExpUtMultipleDonors(S[i], [], depth) + scoreMultipleDonors(S[i]));
            }

            log["crossed_tests"] = [];
            let T = obtenirConjuntOrdenatPerValor(S, val); // Llista d'elements de S ordenats incrementalment pel seu val.
            no_more_transplantations = true;

            for (let i = 0; i < T.length; i++) {
                let donant = current === altruist ? altruist : T[i].receptor.donant;
                let receptor = T[i].receptor.receptor;

                if (provaEncreuada(resultatsProvaEncreuada, donant, receptor)) {
                    // Si el resultat de la prova és positiu no es pot fer el trasplantament
                    eliminarDonantCompatibleDeReceptor(donant, receptor);
                    log["crossed_tests"].push({"donor": donant, "receiver": receptor});
                    continue;

                } else {
                    let dadesTransplant = {
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

        log["candidates"] = cadenaTransplants;
        return cadenaTransplants;
    }

    /**
     * Retorna el resultat de la prova encreuada pel donant i receptor passats com argument.
     *
     * @param {Array} resultatsProva - array amb els resultats de les proves encreuades
     * @param {number} donant - id del donant
     * @param {number} receptor - id del receptor
     * @returns {boolean} - Cert si la prova és positiva o fals en cas contrari
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
        // Eliminem l'associació del donant amb el receptor
        delete D[donantId][receptorId];

        // Eliminem el donant de la llista de donants compatibles del receptor
        let donantsCompatibles = R[receptorId].compatible_donors;
        let index = -1;

        for (let i = 0; i < donantsCompatibles.length; i++) {
            if (donantsCompatibles[i].donor === donantId) {
                index = i;
                break;
            }
        }

        if (index === -1) {
            console.log(
                "Error, no s'ha trobat el donant associat " + donantId + " com a donant compatible de " + receptorId
            );
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
        let donantsCompatibles = R[receptorId].compatible_donors;

        for (let i = 0; i < donantsCompatibles.length; i++) {
            if (D[donantsCompatibles[i].donor]) {
                delete D[donantsCompatibles[i].donor][receptorId];
            }
        }
        delete R[receptorId];
    }

    function getDonantsDeReceptor(receptorId) {
        return loadedData.patients[receptorId].related_donors;
    }

    function setIgnorarProbFallada(ignorar) {
        ignorarProbFallada = ignorar;
    }

    /**
     * Determina si *this és igual a OptTras.
     *
     * @param OptTras {OptimitzadorTransplants}
     * @returns {boolean}
     */
    function equal(OptTras){
        return loadedData === OptTras.loadedData;
    }

    /**
     *
     * @param string
     * @returns {number}
     */
    function computeHashCode(string) {
        //TODO seria millor posar-lo en un altre lloc, crec
        let hash = 0, i, chr;
        if (string.length === 0) return hash;
        for (i = 0; i < string.length; i++) {
            chr   = string.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    /**
     *
     * @returns {boolean}
     */
    function hashCode(){
        //TODO esta representacion del hashcode indica que el objeto seria como inmutable, asi le cambiemos el
        //loadedData (Que no se como se podria) siempre retornaria el mismo hashcode.
        if (!hashCodeComputed){
            hashCodeComputed = computeHashCode(JSON.stringify(loadedData));
        }
        return hashCodeComputed;
    }

    function getSummary(){
        return {
            "origin": loadedData.origin,
            "description": loadedData.description,
            "altruists": loadedData.altruists
        };
    }

    function update(){
        //fem una copia
        let obj = JSON.parse(JSON.stringify(loadedData));
        let patients = obj.patients;
        let llistatDonantsIgnoratsExtended = llistatDonantsIgnorats.slice();

        //eliminem primer de tot els receptors.
        for(const receptorIgnorat of llistatReceptorsIgnorats){
            llistatDonantsIgnoratsExtended = llistatDonantsIgnoratsExtended.concat(patients[receptorIgnorat].related_donors);
            delete patients[receptorIgnorat];
        }

        //i ara eliminem els donants.
        for(let key in patients){
            let related_donors = patients[key].related_donors;
            let difference = related_donors.filter(x => llistatDonantsIgnoratsExtended.includes(x));
            for(const donor of difference){
                let index = related_donors.indexOf(donor);
                related_donors.splice(index, 1);
            }
            let compatible_donors = patients[key].compatible_donors;
            let index = 0;


            let compatible_donors_to_remove = [];
            for(const compatible_donor of compatible_donors){
                if(llistatDonantsIgnoratsExtended.includes(compatible_donor.donor)){
                    compatible_donors_to_remove.push(index);
                }
                index += 1;
            }
            for(const compatible_donor_to_remove of compatible_donors_to_remove){
                compatible_donors.splice(compatible_donor_to_remove, 1);
            }
        }
        return obj;
    }

    function getLog(){
        let logAsText =  ">LOG: {}\n".format(Utils.currentDateTime);
        logAsText += ">TRASPLANTAMENTS:\n";
        logAsText += "DONANT;RECEPTOR;PROBABILITAT_EXIT;VALOR\n";

        for(const transplantation of log.candidates){
            logAsText += "{};{};{};{}\n".format(
                transplantation.donant, transplantation.receptor, transplantation.probExit, transplantation.valor
            );
        }

        logAsText += ">POSITIUS PROVES CREUADES\n";
        logAsText += "DONANT;RECEPTOR\n";
        for(const positive of log.crossed_tests){
            logAsText += "{};{}\n".format(positive.donor, positive.receiver);
        }

        return logAsText;
    }

    return {
        buildChain: buildChain,
        getDonantsDeReceptor: getDonantsDeReceptor,
        equal: equal,
        hashCode: hashCode,
        getSummary: getSummary,
        getLog: getLog,
        update: update
    };
};
exports.OptimitzadorTransplantsLib = OptimitzadorTransplants;