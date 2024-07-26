// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import PrivacyWebhookHandlers from "./privacy.js";
import createMetaobject from "./create-metaobject.js";
import updateMetaobject from "./update-metaobject.js";
import fetchMetobject from "./fetch-metaobject.js";
import fetchMetobjectDefinition from "./fetch-metaobject-definition.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

app.get("/api/metaobjects", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    const metaobjectData = await fetchMetobject(res.locals.shopify.session);
    res.status(status).send(metaobjectData);
  } catch (e) {
    console.log(`Failed to fetch MetaObject: ${e.message}`);
    status = 500;
    error = e.message;
    res.status(status).send(e);
  }
});
app.get("/api/metaobjectDefinitions", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    const metaobjectData = await fetchMetobjectDefinition(res.locals.shopify.session);
    res.status(status).send(metaobjectData);
  } catch (e) {
    console.log(`Failed to fetch MetaObjectDefinition: ${e.message}`);
    status = 500;
    error = e.message;
    res.status(status).send(e);
  }
});
app.patch("/api/graphql", async (_req, res) => {
  let status = 200;
  let error = null;
  let { query, variables } = _req.body;

  try {
    const metaobjectData = await updateMetaobject(res.locals.shopify.session,query,variables);
    res.status(status).send(metaobjectData);
  } catch (e) {
    console.log(`Failed to update MetaObject: ${e.message}`);
    status = 500;
    error = e.message;
    res.status(status).send(e);
  }
});
app.post("/api/graphql", async (_req, res) => {
  let status = 200;
  let error = null;
  let { query, variables } = _req.body;

  try {
    const metaobjectData = await createMetaobject(res.locals.shopify.session,query,variables);
    res.status(status).send(metaobjectData);
  } catch (e) {
    console.log(`Failed to Create Object: ${e.message}`);
    status = 500;
    error = e.message;
    res.status(status).send(e);
  }
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);
