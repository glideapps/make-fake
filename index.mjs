import * as fs from "fs";
import { faker } from "@faker-js/faker";
import { stringify } from "csv-string";
import sample from "lodash/sample.js";
import chunk from "lodash/chunk.js";
import range from "lodash/range.js";

// Set this to 1/10 to only generate a 10th the number of rows.
const scale = 1;

function makeRow(columns) {
    let row = {};
    for (const [k, f] of Object.entries(columns)) {
        row[k] = f(row);
    }
    return row;
}

const rowsForSpec = new Map();

function getRows(spec) {
    let rows = rowsForSpec.get(spec);
    if (rows === undefined) {
        rows = [];
        for (let i = 0; i < Math.floor(spec.numRows * scale); i++) {
            rows.push(makeRow(spec.columns));
        }
        rowsForSpec.set(spec, rows);
    }
    return rows;
}

// spec -> column name -> values array
const columnValuesForSpec = new Map();

function getColumnValues(spec, columnName) {
    let valuesForColumns = columnValuesForSpec.get(spec);
    if (valuesForColumns === undefined) {
        valuesForColumns = new Map();
        columnValuesForSpec.set(spec, valuesForColumns);
    }

    let values = valuesForColumns.get(columnName);
    if (values === undefined) {
        values = new Set();
        for (const row of getRows(spec)) {
            values.add(row[columnName]);
        }
        values = Array.from(values);
        valuesForColumns.set(columnName, values);
    }
    return values;
}

function fromColumn(spec, columnName) {
    const values = getColumnValues(spec, columnName);
    return sample(values);
}

function writeCSV(spec) {
    const filename = `${spec.name}.csv`;

    const header = stringify(Object.keys(spec.columns));
    fs.writeFileSync(filename, header);

    for (const rows of chunk(getRows(spec), 100_000)) {
        const lines = rows.map((r) => stringify(Object.values(r)));
        fs.appendFileSync(filename, lines.join(""));
    }
}

function makeBiased(gen, getKey) {
    const poolByKey = new Map();
    return (x) => {
        const k = getKey?.(x);
        let pool = poolByKey.get(k);
        if (pool === undefined) {
            pool = [];
            poolByKey.set(k, pool);
        }

        let v;
        if (pool.length === 0 || Math.random() < 0.1) {
            v = gen();
        } else {
            v = sample(pool);
        }
        pool.push(v);
        return v;
    };
}

const companySpec = {
    name: "companies",
    numRows: 50_000,
    columns: {
        Name: () => faker.company.name(),
        Mission: () => faker.company.catchPhrase(),
        Address: () => {
            const state = faker.address.stateAbbr();
            return `${faker.address.streetAddress()}, ${state} ${faker.address.zipCodeByState(
                state
            )}`;
        },
        Image: () => faker.image.business(undefined, undefined, true),
        URL: () => faker.internet.url(),
        ID: () => `cmp-${faker.random.alpha(10)}`,
    },
};

const peopleSpec = {
    name: "people",
    numRows: 200_000,
    columns: {
        Name: () => faker.name.fullName(),
        CompanyID: () => fromColumn(companySpec, "ID"),
        Title: makeBiased(
            () => `${faker.name.jobArea()} ${faker.name.jobType()}`,
            (r) => r.CompanyID
        ),
        Salary: makeBiased(
            () => faker.finance.amount(30_000, 200_000, 0),
            (r) => r.Title
        ),
        Email: () => faker.internet.email(),
        Phone: () => faker.phone.number(),
        Photo: () => faker.image.avatar(),
    },
};

const productSpec = {
    name: "products",
    numRows: 1_000_000,
    columns: {
        Name: () => faker.commerce.productName(),
        Material: makeBiased(() => faker.commerce.productMaterial()),
        Category: makeBiased(() => faker.commerce.department()),
        Image: () => faker.image.technics(undefined, undefined, true),
        Price: makeBiased(
            () => faker.commerce.price(),
            (r) => `${r.Category}-${r.Material}`
        ),
        ID: () => `prd-${faker.random.alpha(10)}`,
        CompanyID: () => fromColumn(companySpec, "ID"),
    },
};

const ordersSpec = {
    name: "orders",
    numRows: 10_000_000,
    columns: {
        ID: () => `ord-${faker.random.alpha(10)}`,
        ProductID: () => fromColumn(productSpec, "ID"),
        Quantity: () => faker.datatype.number({ min: 1, max: 99 }),
        Date: () => faker.date.past(3).toISOString(),
    },
};

function mainCommercial() {
    for (const spec of [companySpec, peopleSpec, productSpec, ordersSpec]) {
        writeCSV(spec);
    }
}

function mainDummy() {
    const numCols = 500;
    const numRows = 20000;

    const header = stringify(range(numCols).map((i) => `Col ${i} yo`));
    let n = 0;
    const rows = range(numRows).map(() =>
        stringify(range(numCols).map(() => `${n++}`))
    );

    fs.writeFileSync("dummy.csv", [header, ...rows].join(""));
}

mainCommercial();
