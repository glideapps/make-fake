import * as fs from "fs";
import { faker } from "@faker-js/faker";
import { stringify } from "csv-string";
import sample from "lodash/sample.js";
import chunk from "lodash/chunk.js";

// Set this to 1/10 to only generate a 10th the number of rows.
const scale = 1 / 1;

function makeRow(columns) {
    let row = {};
    for (const [k, f] of Object.entries(columns)) {
        row[k] = f();
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
        Title: () => faker.name.jobTitle(),
        Email: () => faker.internet.email(),
        Phone: () => faker.phone.number(),
        Photo: () => faker.image.avatar(),
        CompanyID: () => fromColumn(companySpec, "ID"),
    },
};

const productSpec = {
    name: "products",
    numRows: 1_000_000,
    columns: {
        Name: () => faker.commerce.productName(),
        Material: () => faker.commerce.productMaterial(),
        Category: () => faker.commerce.department(),
        Image: () => faker.image.technics(undefined, undefined, true),
        Price: () => faker.commerce.price(),
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

function main() {
    for (const spec of [companySpec, peopleSpec, productSpec, ordersSpec]) {
        writeCSV(spec);
    }
}

main();
