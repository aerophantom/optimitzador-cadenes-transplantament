import Utils from './Utils.mjs';

/**
 * Class that represents a trasplant optimizer.
 */
export default class TransplantOptimizer{

    /**
     * Lists that contains identifiers (from donors or recipients)
     * @typedef {Array.<string>} Identifiers
     */

    /**
     * List of objects that determines a chain
     * @typedef {Array.<{receptor: string, donant: string, probExit: number, valor: number}>} Chain
     */

    /**
     * Class constructor.
     * @param {Object} _compatibilityGraph
     */
    constructor(_compatibilityGraph){
        this._CompatibilityGraph = _compatibilityGraph;
        this._Recipients = null;
        this._Donors = null;
        this._AssociatedDonors = {};
        this._IgnoredDonors = [];
        this._IgnoredRecipients = [];
        this._IgnoreFailureProbability = false;
        this._HashCodeComputed = false;
        this._Log = {
            "candidates": [],
            "crossed_tests": [],
            "errors": []
        };
        this._secondsElapsed = 0;
    }

    /**
     * Inicialitza els receptors creant una còpia del contingut de la memòria i
     * eliminant els receptors passats com argument.
     *
     * @param {Object} [kwargs={}] - Arguments opcionals per inicialitzar els
     * receptors.
     * @param {Identifiers} [kwargs.ignoredDonors=[]] - array de id de
     * donants a ignorar.
     * @param {Identifiers} [kwargs.ignoredRecipients=[]] - array de id de
     * receptors a ignorar.
     */
    inicialitzarReceptors(kwargs = {}) {
        let ignoredRecipients = kwargs.ignoredRecipients || [];
        let ignoredDonors = kwargs.ignoredDonors || [];

        this._Recipients = JSON.parse(
            JSON.stringify(this._CompatibilityGraph.patients)
        );

        if (ignoredRecipients) {
            for(const ignoredRecipient of ignoredRecipients){
                this._IgnoredRecipients.push(ignoredRecipient);
                delete this._Recipients[ignoredRecipient];
            }
        }

        this._AssociatedDonors = {};

        for (let recipientId in this._Recipients) {
            for (const donor of this._Recipients[recipientId].related_donors) {
                if (ignoredDonors && ignoredDonors.includes(donor)) {
                    this._IgnoredDonors.push(donor);
                }
                else{
                    this._AssociatedDonors[donor] = recipientId;
                }
            }
        }
    }

    /**
     * Inicialitza el llistat de donants, a partir dels donants compatibles de
     * la llista de receptors, tenint en compte la llista de donants ignorats.
     *
     * Els receptors associats als donants ignorats són exclosos del llistat de
     * receptors.
     *
     * @param {Object} [kwargs={}] - Arguments opcionals per inicialitzar els
     * receptors.
     * @param {Identifiers} [kwargs.ignoredDonors=[]] - array de id de
     * donants a ignorar.
     */
    inicialitzarDonants(kwargs = {}) {
        let ignoredDonors = kwargs.ignoredDonors || [];

        this._Donors = {};

        if (ignoredDonors) {
            for(const ignoredDonor of ignoredDonors){
                let associatedRecipient = this._AssociatedDonors[ignoredDonor];

                if (associatedRecipient) {
                    // Eliminem el donant associat del receptor
                    let donantsAssociatsAlReceptor = this._Recipients[associatedRecipient].related_donors;
                    let index = donantsAssociatsAlReceptor.indexOf(ignoredDonor);
                    donantsAssociatsAlReceptor.splice(index, 1);
                    this._IgnoredDonors.push(ignoredDonor);

                    // Si no hi ha cap donant associat al receptor, s'elimina
                    // de la llista de receptors
                    if (donantsAssociatsAlReceptor.length === 0) {
                        this._IgnoredRecipients.push(associatedRecipient);
                        delete this._Recipients[associatedRecipient];
                    }
                }
            }
        }
        for (let recipientId in this._Recipients) {
            for (const donant of this._Recipients[recipientId].compatible_donors) {
                // TODO aixo es pot refactoritzar
                if (ignoredDonors && ignoredDonors.includes(donant.donor)) {
                    // No s'afegeixen els donants ignorats
                    continue;
                }
                if (!this._Donors[donant.donor]) {
                    this._Donors[donant.donor] = {};
                }
                this._Donors[donant.donor][recipientId] = donant;
            }
        }
    }

    /**
     * Retorna un array de diccionari de dades amb els receptors compatibles
     * amb el donant associat al receptor passat com argument.
     *
     * @param {Object} parell - tupla que conté la informació d'un donant i un
     * receptor.
     * @returns {Array} - array de tuples de dades amb els receptors
     * compatibles amb el donant associat.
     */
    succMultipleDonors(parell) {
        let donantsAssociats = this._CompatibilityGraph.patients[parell.receptor].related_donors;
        let successors = [];

        for (const donor of donantsAssociats) {
            if (!this._IgnoredDonors.includes(donor)) {
                let auxSuccessors = this.succDonant(donor);

                for (const recipient of auxSuccessors) {
                    successors.push({receptor: recipient, donant: donor});
                }
            }
        }
        return successors;
    }

    /**
     * Retorna un array de dades amb els receptors compatibles amb el donant
     * passat com argument.
     *
     * @param {string} donorId - identificador del donant
     * @returns {Array} - array de dades amb els receptors compatibles amb el
     * donant.
     * @private
     */
    succDonantMultipleDonors(donorId) {
        let successors = [];

        if (!this._IgnoredDonors.includes(donorId)) {
            let auxSuccessors = this.succDonant(donorId);

            for (const recipient of auxSuccessors) {
                successors.push({receptor: recipient, donant: donorId});
            }
        }
        return successors;
    }

    /**
     * Retorna un array amb els identificadors dels receptors compatibles amb
     * el donant corresponent al id passat com argument.
     *
     * @param {string} donorId - id del donant
     * @returns {Identifiers} - array amb els identificadors dels receptors
     * compatibles amb el donant.
     */
    succDonant(donorId) {
        let compatibleRecipients = [];
        if (this._Donors[donorId]) {
            compatibleRecipients = Object.keys(this._Donors[donorId]);
        }
        return compatibleRecipients;
    }

    /**
     * Retorna la probabilitat d'èxit d'un trasplantament entre el donant i el
     * receptor passats com argument.
     *
     * @param {string} donorId - id del donant
     * @param {string} recipientId - id del receptor
     * @returns {number} - probabilitat d'èxit del trasplantament
     */
    spDonant(donorId, recipientId) {
        let p = 1;
        if (!this._IgnoreFailureProbability) {
            p = 1 - this._Donors[donorId][recipientId].failure_prob;
        }
        return p;
    }

    /**
     * Retorna la puntuació de trasplantament entre el parell donant-receptor
     *
     * @param {Object} parell - Objecte que conté la informació d'un donant i
     * un receptor
     * @param {string} parell.donant - Identificador del donant.
     * @param {string} parell.receptor - Identificador del receptor
     * @returns {number} - puntuació del trasplantament
     */
    scoreMultipleDonors(parell) {
        return this.scoreDonant(parell.donant, parell.receptor);
    }

    /**
     * Retorna la puntuació de trasplantament entre el donant i el receptor
     * passats com argument.
     *
     * @param {string} donant - id del donant
     * @param {string} receptor - id del receptor
     * @returns {number} - puntuació del trasplantament
     * @private
     */
    scoreDonant(donant, receptor) {
        let puntuacio;

        if (!this._Donors[donant][receptor]) {
            let error = "El receptor {} no és compatible amb el donant {}".format(receptor, donant);
            this._Log.errors.push(error);
        } else {
            puntuacio = this._Donors[donant][receptor].score;
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
    static eliminarElementsDelConjuntMultipleDonors(conjuntA, conjuntB) {
        let nouConjunt = [];

        for (const elemA of conjuntA) {
            if (!conjuntB.includes(elemA.receptor)) {
                nouConjunt.push(elemA);
            }
        }
        return nouConjunt;
    }

    /**
     * Crea un array ordenat de tuples amb la informació corresponent als
     * arrays passats per argument ordenat per val.
     *
     * @param {Array} S - array amb les dades a ordenar
     * @param {Array} val - array de valors corresponents a S
     * @returns {Array} - array de tuples amb la informació passada per
     * paràmetres ordenada incrementalment
     * @private
     */
    static obtenirConjuntOrdenatPerValor(S, val) {
        let T = [];

        for (let i = 0; i < S.length; i++) {
            T.push({
                receptor: S[i],
                valor: val[i]
            });
        }
        T.sort(function (a, b) {
            return b.valor - a.valor;
        });
        return T;
    }

    /**
     * Retorna la puntuació acumulada esperada a obtenir de la cadena originada
     * a rec que no inclou cap receptor de rec_list.
     * La funció només explora els primers nivells de profunditat (a partir de
     * rec)
     *
     * @param {number} rec - id del receptor
     * @param {Identifiers} rec_list - array amb els id dels elements a
     * ignorar (els receptors processats anteriorment)
     * @param {number} depth - profunditat a explorar.
     */
    ExpUtMultipleDonors(rec, rec_list, depth) {
        // S és el llistat de receptors successors com a tupla a la que s'ha
        // afegit la dada "donant_candidat"
        let S = this.succMultipleDonors(rec);

        S = TransplantOptimizer.eliminarElementsDelConjuntMultipleDonors(S, rec_list);
        rec_list = rec_list.slice();


        // Aquesta és la condició que finalitza la recursió
        if (S.length === 0 || depth === 0) {
            return 0;
        } else {
            let val = [];

            let receptor = isNaN(rec) ? rec.receptor : rec;
            for (let s of S) {
                if (!rec_list.includes(receptor)) {
                    rec_list.push(receptor); // [rec | rec_list]
                }

                val.push(
                    // Només cal passar el receptor perquè inclou la referència
                    // al donant candidat
                    this.ExpUtMultipleDonors(s, rec_list, depth - 1) + this.scoreMultipleDonors(s)
                );
            }
            // Llista d'elements de S ordenats incrementalment pel seu val.
            let T = TransplantOptimizer.obtenirConjuntOrdenatPerValor(S, val);
            return this.sumatoriProbabilitatsMultipleDonants(T);
        }
    }

    /**
     * Sumatori dels valors segons l'algorisme (transparència 38).
     *
     * @param {Array} T - array de tuples que conté la informació sobre els
     * successors (receptors compatibles amb el donant associat al receptor) i
     * el valor calculat corresponent
     * @returns {number} - valor calculat
     */
    sumatoriProbabilitatsMultipleDonants(T) {
        let sumatori = 0;

        for (let i = 0; i < T.length; i++) {
            // Alerta, en la formula és val(ti), estan coordinats per l'índex
            // (val[i] correspon al valor de T[i]
            sumatori += this.spDonant(T[i].receptor.donant, T[i].receptor.receptor) * T[i].valor * this.productoriProbabilitatMultipleDonants(i, T);
        }
        return sumatori;
    }

    /**
     * Productori dels valors segons l'algorisme (transparència 32).
     *
     * @param {number} i -  índex a partir del qual es comença a iterar.
     * @param {Array} T - array de tuples que conté la informació sobre els
     * successors (receptors compatibles amb el donant associat al receptor) i
     * el valor calculat corresponent
     * @returns {number} - valor calculat
     */
    productoriProbabilitatMultipleDonants(i, T) {
        let productori = 1;

        if (!this._IgnoreFailureProbability) {
            for (let j=0; j<i; j++) {
                productori *= 1 - this.spDonant(T[j].receptor.donant, T[j].receptor.receptor);
            }
        }
        return productori;
    }

    /**
     * Genera una cadena de trasplantament optimitzada a partir d'un donant
     * altruista tenint en compte la profunditat màxima a explorar, els donants
     * i receptors a ignorar i els resultats de les proves encreuades.
     *
     * @param {number} depth - profunditat màxima a explorar.
     * @param {string} altruist - id del donant altruista que inicia la cadena.
     * @param {Object} [kwargs={}] - arguments opcionals per construir la
     * cadena.
     * @param {Identifiers} [kwargs.ignoredDonors=[]] - array de id de donants
     * a ignorar.
     * @param {Identifiers} [kwargs.ignoredRecipients=[]] - array de id de
     * receptors a ignorar.
     * @param {Array} [kwargs.crossedTests=[]] - array de cadenes de text amb
     * les parelles de la prova encreuada que han donat positiu.
     * @param {Array} [kwargs.ignoreFailureProbability=false] - indica si es
     * ignora la probabilitat de fallada.
     * @param {number} [kwargs.chainLength=Infinity] - Longitud de la cadena que es
     * vol generar.
     * @returns {Chain} - array de tuples amb les dades de trasplantament.
     * @public
     */
    buildChain(depth, altruist, kwargs = {}) {
        let current = altruist;
        let no_more_transplantations;
        let cadenaTransplants = [];
        let resultatsProvaEncreuada = kwargs.crossedTests || [];
        let chainLength = kwargs.chainLength ||Infinity;

        this._IgnoredDonors = [];
        this._IgnoredRecipients = [];
        this._IgnoreFailureProbability = kwargs.ignoreFailureProbability || false;

        this.inicialitzarReceptors(kwargs);
        this.inicialitzarDonants(kwargs);

        let startTime = new Date();
        do {
            let S;
            if (current === altruist) {
                S = this.succDonantMultipleDonors(altruist);
            } else {
                S = this.succMultipleDonors(current);
            }

            let val = [];

            for (let recipient of S) {
                val.push(
                    this.ExpUtMultipleDonors(recipient, [], depth) +
                    this.scoreMultipleDonors(recipient)
                );
            }

            this._Log.crossed_tests = [];
            // Llista d'elements de S ordenats incrementalment pel seu val.
            let T = TransplantOptimizer.obtenirConjuntOrdenatPerValor(S, val);
            no_more_transplantations = true;

            for (const trasplantament of T) {
                let donant = trasplantament.receptor.donant;
                if(current === altruist){
                    donant = altruist;
                }
                let receptor = trasplantament.receptor.receptor;

                let positiveCrossedTest = TransplantOptimizer.provaEncreuada(
                    resultatsProvaEncreuada, donant, receptor
                );
                if (positiveCrossedTest) {
                    // Si el resultat de la prova és positiu no es pot fer el
                    // trasplantament
                    this.eliminarDonantCompatibleDeReceptor(donant, receptor);
                    this._Log.crossed_tests.push(
                        {"donor": donant, "receiver": receptor}
                    );
                    continue;

                } else {
                    let dadesTransplant = {
                        receptor: receptor,
                        donant: donant,
                        probExit: this.spDonant(donant, receptor),
                        valor: trasplantament.valor
                    };
                    cadenaTransplants.push(dadesTransplant);
                    delete this._Donors[dadesTransplant.donant];
                    this.eliminarReceptor(dadesTransplant.receptor);
                    current = trasplantament.receptor;
                    no_more_transplantations = cadenaTransplants.length >= chainLength;
                }
                break;
            }

        } while (!no_more_transplantations);
        let endTime = new Date();
        let timeDiff = endTime - startTime; // in ms
        timeDiff /= 1000;
        this._secondsElapsed = Math.round(timeDiff);
        this._Log.candidates = cadenaTransplants;
        return cadenaTransplants;
    }

    /**
     * Retorna el resultat de la prova encreuada pel donant i receptor passats
     * com argument.
     *
     * @param {Array} resultatsProva - array amb els resultats de les proves
     * encreuades
     * @param {string} donant - id del donant
     * @param {string} receptor - id del receptor
     * @returns {boolean} - Cert si la prova és positiva o fals en cas contrari
     */
    static provaEncreuada(resultatsProva, donant, receptor) {
        //TODO refactoritzable
        if (!resultatsProva || !donant || !receptor) {
            return false;
        } else {
            return resultatsProva.includes(receptor + "-" + donant);
        }
    }

    /**
     * Elimina un donant de la llista de donants compatibles d'un receptor.
     *
     * @param {string} donorId - id del donant
     * @param {string} recipientId - id del receptor
     */
    eliminarDonantCompatibleDeReceptor(donorId, recipientId) {
        // Eliminem l'associació del donant amb el receptor
        delete this._Donors[donorId][recipientId];

        // Eliminem el donant de la llista de donants compatibles del receptor
        let donantsCompatibles = this._Recipients[recipientId].compatible_donors;
        let index = -1;

        for (let i = 0; i < donantsCompatibles.length; i++) {
            if (donantsCompatibles[i].donor === donorId) {
                index = i;
                break;
            }
        }

        if (index === -1) {
            this._Log.errors.push(
                "no s'ha trobat el donant associat " + donorId +
                " com a donant compatible de " + recipientId
            );
        } else {
            donantsCompatibles.splice(index, 1);
        }
    }

    /**
     * Elimina un receptor de la llista de receptors i els seus donants
     * associats
     *
     * @param {string} recipientId - id del receptor
     */
    eliminarReceptor(recipientId) {
        let donantsCompatibles = this._Recipients[recipientId].compatible_donors;

        for (const donantCompatible of donantsCompatibles) {
            if (this._Donors[donantCompatible.donor]) {
                delete this._Donors[donantCompatible.donor][recipientId];
            }
        }
        delete this._Recipients[recipientId];
    }

    /**
     * Obtains the related donors of the recipient passed by parameter.
     *
     * @param recipientId
     * @returns {Array.<string>}
     */
    getDonantsDeReceptor(recipientId) {
        return this._CompatibilityGraph.patients[recipientId].related_donors;
    }

    /**
     * Obtains *this' hash code. No matter what, the hash code will remain
     * always the same because this class is considered inmutable.
     *
     * The hash code of *this is the same as the compatibility graph.
     *
     * @returns {number} - Hash code of *this.
     */
    get hashCode(){
        if (!this._HashCodeComputed){
            let compatibilityGraphAsString = JSON.stringify(
                this._CompatibilityGraph
            );
            this._HashCodeComputed = compatibilityGraphAsString.hashCode();
        }
        return this._HashCodeComputed;
    }

    /**
     * Obtains the log as the result of calculating the transplant's chain.
     *
     * @returns {string}
     */
    get log(){
        let logAsText =  ">LOG: {}\n".format(Utils.currentDateTime);
        logAsText += "HASH FITXER ORIGINAL: {}\n".format(this.hashCode);
        logAsText += ">TRASPLANTAMENTS:\n";
        logAsText += "DONANT;RECEPTOR;PROBABILITAT_EXIT;VALOR\n";

        for(const transplantation of this._Log.candidates){
            logAsText += "{};{};{};{}\n".format(
                transplantation.donant, transplantation.receptor,
                transplantation.probExit, transplantation.valor
            );
        }
        logAsText += ">PARAMETRITZACIÓ\n";
        let ignoraProabilitat = "fals";
        if(this._IgnoreFailureProbability){
            ignoraProabilitat = "cert";
        }
        logAsText += ">>IGNORAR PROBABILITAT FALLADA: {}\n".format(
            ignoraProabilitat
        );
        logAsText += ">>DONANTS IGNORATS\n";
        for(const ignoredDonor of this._IgnoredDonors){
            logAsText += ignoredDonor;
        }
        logAsText += ">>RECEPTORS IGNORATS\n";
        for(const ignoredRecipient of this._IgnoredRecipients){
            logAsText += ignoredRecipient;
        }

        logAsText += ">>POSITIUS PROVES CREUADES\n";
        logAsText += "DONANT;RECEPTOR\n";
        for(const positive of this._Log.crossed_tests){
            logAsText += "{};{}\n".format(positive.donor, positive.receiver);
        }
        logAsText += "\nTime elapsed: {} s".format(this._secondsElapsed);
        return logAsText;
    }

    /**
     * Obtains the origin, description and altruists from de compatibility
     * graph.
     *
     * @returns {{origin: string, description: string, altruists: (string[])}}
     */
    get summary(){
        return {
            "origin": this._CompatibilityGraph.origin,
            "description": this._CompatibilityGraph.description,
            "altruists": this._CompatibilityGraph.altruists
        };
    }

    /**
     * Obtains the updated compatibility graph according to the ignored donors
     * and the ignored recipients.
     *
     * @returns {Object} - Updated compatibility graph.
     */
    get update(){
        //fem una copia
        let obj = JSON.parse(JSON.stringify(this._CompatibilityGraph));
        let patients = obj.patients;
        let llistatDonantsIgnoratsExtended = this._IgnoredDonors.slice();

        //eliminem primer de tot els receptors.
        for(const receptorIgnorat of this._IgnoredRecipients){
            llistatDonantsIgnoratsExtended = llistatDonantsIgnoratsExtended.concat(patients[receptorIgnorat].related_donors);
            delete patients[receptorIgnorat];
        }

        //i ara eliminem els donants.
        for(let key in patients){
            let related_donors = patients[key].related_donors;
            let difference = related_donors.filter(
                x => llistatDonantsIgnoratsExtended.includes(x)
            );
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
}
