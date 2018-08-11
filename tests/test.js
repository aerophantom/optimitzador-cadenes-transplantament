"use strict";

import test from 'ava';
import TransplantOptimizer from '../public/js/TransplantOptimizer.mjs';

// TODO temporal: serial ideal carregar el fitxer abans d'executar
// els tests
let file = {
    "origin": "TESTS",
    "description": "Fitxer arcs5.json. Arc de prova amb només 5 receptors i les dades mínimes per provar la aplicació. Els id dels donants altruistes es correspoan amb el codi 1xxx, els receptors amb el codi 2xxx i els donants associats amb el codi 3xxx",
    "altruists": [
        "1000",
        "1001"
    ],
    "patients": {
        "2000": {
            "related_donors": [
                "3000",
                "3001"
            ],
            "compatible_donors": [
                {
                    "failure_prob": 0.2,
                    "score": 58.95,
                    "donor": "1000"
                },
                {
                    "failure_prob": 0.2,
                    "score": 38.95,
                    "donor": "3001"
                },
                {
                    "failure_prob": 0.1,
                    "score": 93.25,
                    "donor": "3002"
                },
                {
                    "failure_prob": 0.15,
                    "score": 60.50,
                    "donor": "3003"
                }
            ]
        },
        "2001": {
            "related_donors": [
                "3002"
            ],
            "compatible_donors": [
                {
                    "failure_prob": 0.2,
                    "score": 89.55,
                    "donor": "3000"
                },
                {
                    "failure_prob": 0.1,
                    "score": 54.88,
                    "donor": "3003"
                }
            ]
        },
        "2002": {
            "related_donors": [
                "3003",
                "3004",
                "3005"
            ],
            "compatible_donors": [
                {
                    "failure_prob": 0.2,
                    "score": 33.54,
                    "donor": "1001"
                },
                {
                    "failure_prob": 0.2,
                    "score": 59.59,
                    "donor": "3000"
                },
                {
                    "failure_prob": 0.5,
                    "score": 24.32,
                    "donor": "3004"
                },
                {
                    "failure_prob": 0.1,
                    "score": 76.30,
                    "donor": "3006"
                }
            ]
        },
        "2003": {
            "related_donors": [
                "3006"
            ],
            "compatible_donors": [
                {
                    "failure_prob": 0.5,
                    "score": 24.29,
                    "donor": "3001"
                },
                {
                    "failure_prob": 0.2,
                    "score": 44.55,
                    "donor": "3007"
                },
                {
                    "failure_prob": 0.5,
                    "score": 24.29,
                    "donor": "3008"
                }
            ]
        },
        "2004": {
            "related_donors": [
                "3007",
                "3008"
            ],
            "compatible_donors": [
                {
                    "failure_prob": 0.1,
                    "score": 50.88,
                    "donor": "3000"
                },
                {
                    "failure_prob": 0.5,
                    "score": 74.11,
                    "donor": "3002"
                },
                {
                    "failure_prob": 0.5,
                    "score": 68.23,
                    "donor": "3006"
                }
            ]
        }
    }
};

test('build chain with crossed test', t => {
    let to = new TransplantOptimizer(file);
    let kwargs = {"crossedTests": ["2003-3001"]};
    let chain = to.buildChain(3, "1000", kwargs);
    for (const transplant of chain) {
        if (transplant.donant === "3001" && transplant.receptor === "2003") {
            t.fail('The final chain contains the transplant with 2003 as ' +
                'donor and 2003 as recipient'
            );
        }
    }
    t.pass();
});

test('initialize recipients', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();

    t.truthy(to._Recipients["2000"]);
    t.truthy(to._Recipients["2001"]);
    t.truthy(to._Recipients["2002"]);
    t.truthy(to._Recipients["2003"]);
    t.truthy(to._Recipients["2004"]);
});

test('initialize recipients ignoring some recipients', t => {
    let kwargs = {ignoredRecipients: ["2001", "2002"]};
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors(kwargs);

    t.falsy(to._Recipients["2001"]);
    t.falsy(to._Recipients["2002"]);
    t.truthy(to._Recipients["2000"]);
    t.truthy(to._Recipients["2003"]);
    t.truthy(to._Recipients["2004"]);
});

test('initialize donors', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    t.falsy(to._Donors["3005"]);
    t.truthy(to._Donors["1000"]);
    t.truthy(to._Donors["1001"]);
    t.truthy(to._Donors["3000"]);
    t.truthy(to._Donors["3001"]);
    t.truthy(to._Donors["3002"]);
    t.truthy(to._Donors["3003"]);
    t.truthy(to._Donors["3004"]);
    t.truthy(to._Donors["3006"]);
    t.truthy(to._Donors["3007"]);
    t.truthy(to._Donors["3008"]);
});

test('initialize donors ignoring some donors', t =>{
    let kwargs = {ignoredDonors: ["3000", "3001"], ignoredRecipients: []};

    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors(kwargs);
    to.inicialitzarDonants(kwargs);

    t.falsy(to._Donors["3000"]);
    t.falsy(to._Donors["3001"]);
    t.falsy(to._Donors["3005"]);
    t.truthy(to._Donors["1000"]);
    t.truthy(to._Donors["1001"]);
    t.truthy(to._Donors["3002"]);
    t.truthy(to._Donors["3003"]);
    t.truthy(to._Donors["3004"]);
    t.truthy(to._Donors["3006"]);
    t.truthy(to._Donors["3007"]);
    t.truthy(to._Donors["3008"]);
});

test('delete recipient', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    to.eliminarReceptor("2000");

    t.falsy(to._Recipients["2000"]);
    t.truthy(to._Recipients["2001"]);
    t.truthy(to._Recipients["2002"]);
    t.truthy(to._Recipients["2003"]);
    t.truthy(to._Recipients["2004"]);
});

test('remove compatible donor from recipient', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    to.eliminarDonantCompatibleDeReceptor("3002", "2000");

    let donantsCompatibles = to._Recipients["2000"].compatible_donors;
    for (const donantCompatible of donantsCompatibles) {
        t.not(donantCompatible.donor, "2000");
    }
});

test('get donant successors\'', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    let successors = to.succDonant("3000");
    t.is(successors.length, 3);
    t.true(successors.includes("2001"));
    t.true(successors.includes("2002"));
    t.true(successors.includes("2004"));

});

test('testObtenirSuccessorsDeReceptor', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    let successors = to.succMultipleDonors({receptor: "2000"});

    let aux = [];
    for (const successor of successors) {
        aux.push(successor.receptor + '-' + successor.donant);
    }

    t.is(aux.length, 5);
    t.true(aux.includes("2000-3001"));
    t.true(aux.includes("2001-3000"));
    t.true(aux.includes("2002-3000"));
    t.true(aux.includes("2003-3001"));
    t.true(aux.includes("2004-3000"));
});

test('get success probability', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    let successProbability = to.spDonant("3000", "2002");
    t.is(successProbability, 0.8);
});

test('get score', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    let score = to.scoreMultipleDonors({donant: "3000", receptor: "2002"});
    t.is(score, 59.59);
});

test('positive crossed test', t => {
    t.true(TransplantOptimizer.provaEncreuada(["2002-3001"], "3001", "2002"));
});

test('negative crossed test', t  => {
    t.false(TransplantOptimizer.provaEncreuada(["2000-3000"], "3001", "2002"));
});

test('calculate summation', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    let T = [
        {receptor: {receptor: "2001", donant: "3000"}, valor: "100"},  // pf: 0.2
        {receptor: {receptor: "2002", donant: "3000"}, valor: "50"},  // pf: 0.2
        {receptor: {receptor: "2004", donant: "3000"}, valor: "10"}  // pf: 0.1
    ];

    let sumatori = to.sumatoriProbabilitatsMultipleDonants(T);

    if (sumatori > 88.3599 && sumatori <= 88.36){
        t.pass();
    }
    else{
        t.fail();
    }
});

test('calculate product of sequences', t => {
    let to = new TransplantOptimizer(file);
    to.inicialitzarReceptors();
    to.inicialitzarDonants();

    let T = [
        {receptor: {receptor: "2001", donant: "3000"}},  // pf: 0.2
        {receptor: {receptor: "2002", donant: "3000"}},  // pf: 0.2
        {receptor: {receptor: "2004", donant: "3000"}}  // pf: 0.1
    ];

    let productori = to.productoriProbabilitatMultipleDonants(3, T);
    if (productori > 0.0039 && productori <= 0.004){
        t.pass();
    }
    else{
        t.fail();
    }
});

test('build chain', t => {
    let to = new TransplantOptimizer(file);
    let chain = to.buildChain(3, "1000");

    t.is(chain.length, 5);
    t.is(chain[0].receptor, "2000");
    t.is(chain[0].donant, "1000");
    t.is(chain[1].receptor, "2004");
    t.is(chain[1].donant, "3000");
    t.is(chain[2].receptor, "2003");
    t.is(chain[2].donant, "3007");
    t.is(chain[3].receptor, "2002");
    t.is(chain[3].donant, "3006");
    t.is(chain[4].receptor, "2001");
    t.is(chain[4].donant, "3003");
});

test('build chain ignoring recipient', t => {
    let to = new TransplantOptimizer(file);
    let kwargs = {ignoredRecipients: ["2003"]};
    let chain = to.buildChain(3, "1000", kwargs);
    t.is(chain.length, 4);
    t.is(chain[0].receptor, "2000");
    t.is(chain[0].donant, "1000");
    t.is(chain[1].receptor, "2002");
    t.is(chain[1].donant, "3000");
    t.is(chain[2].receptor, "2001");
    t.is(chain[2].donant, "3003");
    t.is(chain[3].receptor, "2004");
    t.is(chain[3].donant, "3002");
});

test('build chain ignoring the altruist donor', t => {
    let to = new TransplantOptimizer(file);
    let kwargs = {ignoredDonors: ["1000"]};
    let chain = to.buildChain(3, "1000", kwargs);
    t.is(chain.length, 0);
});

test('build chain ignoring the main recipient', t => {
    let to = new TransplantOptimizer(file);
    let kwargs = {ignoredRecipients: ["2000"]};
    let chain = to.buildChain(3, "1000", kwargs);
    t.is(chain.length, 0);
});
