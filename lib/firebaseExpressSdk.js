const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function checkIfBodyHasAllKeys(body, keys) {
  return keys.every((key) => body[key]);
}

function getMissingKeys(body, keys) {
  return keys.filter((key) => !body[key]);
}

function checkIfBodyHasDifferentKeys(body, keys) {
  return Object.keys(body).some((key) => !keys.includes(key));
}

function checkIfDocumentAttributesAreProvided(collections) {
  Object.keys(collections).forEach((collection) => {
    const { documentAttributes } = collections[collection];

    if (!documentAttributes) {
      throw new Error(
        `You must provide documentAttributes for collection ${collection}`
      );
    }
  });
}

class FirebaseExpressSDK {
  db = null;
  serviceAccountFile = null;
  app = null;
  collections = [];

  constructor({ app, serviceAccountFile, collections, port }) {
    checkIfDocumentAttributesAreProvided(collections);

    this.serviceAccountFile = serviceAccountFile;
    this.app = app;
    this.collections = collections;
    this.port = port || 3000;

    this.initializeFirebase(serviceAccountFile);
  }

  initializeFirebase(serviceAccountFile) {
    const app = initializeApp({
      credential: cert(serviceAccountFile),
    });

    this.db = getFirestore(app);
  }

  addActions(actions) {
    actions.forEach((action) => {
      this.addAction(action);
    });

    this.appListen({ port: this.port, app: this.app });
  }

  addAction(action) {
    const { collection, endpoint, request } = action;

    switch (request.type) {
      case "GET":
        this.addGetAction(collection, endpoint, request);
        break;

      case "POST":
        this.addPostAction(collection, endpoint, request);
        break;

      case "DELETE":
        this.addDeleteAction(collection, endpoint, request);
        break;

      case "PUT":
        this.addPutAction(collection, endpoint, request);
        break;

      case "PATCH":
        this.addPatchAction(collection, endpoint, request);
        break;

      default:
        throw new Error("Unknown request type: " + request.type);
    }
  }

  addGetAction(collection, endpoint, request) {
    if (request.paramKey && request.query) {
      this.addGetParamAndQueryAction(
        collection,
        endpoint,
        request.paramKey,
        request.query,
        this.app
      );
    } else if (request.query && !request.paramKey) {
      this.addGetQueryAction(collection, endpoint, request.query, this.app);
    } else if (request.paramKey && !request.query) {
      this.addGetParamAction(collection, endpoint, request.paramKey, this.app);
    } else {
      this.addSimpleGetAction(collection, endpoint, this.app);
    }
  }

  addGetParamAndQueryAction(collection, endpoint, paramKey, query, app) {
    const { operator, limit, orderBy, order } = query;

    if (limit && !order && !operator) {
      throw new Error("Limit cannot be used on its own");
    }

    app.get(endpoint, (req, res) => {
      const { params } = req;
      let ref = this.db.collection(collection);
      const value = params[paramKey];

      if (limit) {
        ref = ref.limit(limit);
      }

      if (orderBy && order) {
        ref = ref.orderBy(orderBy, order);
      }

      ref = ref.where(paramKey, operator, value);

      ref
        .get()
        .then((snapshot) => {
          const data = [];

          snapshot.forEach((doc) => {
            data.push({
              id: doc.id,
              ...doc.data(),
            });
          });

          res.send({
            status: "success",
            data,
            message: `Found ${data.length} documents`,
          });
        })
        .catch((error) => {
          res.send({
            status: "error",
            message: error.message,
          });
        });
    });
  }

  addGetQueryAction(collection, endpoint, query, app) {
    const { attribute, value, operator, limit, orderBy, order } = query;

    if (limit && !order && !operator) {
      throw new Error("Limit cannot be used on its own");
    }

    let ref = this.db.collection(collection);

    if (operator) {
      ref = ref.where(attribute, operator, value);
    }
    if (orderBy && order) {
      ref = ref.orderBy(orderBy, order);
    }
    if (limit) {
      ref = ref.limit(limit);
    }

    this.executeGetQuery(ref, endpoint, app);
  }

  addGetParamAction(collection, endpoint, paramKey, app) {
    const ref = this.db.collection(collection);

    app.get(endpoint, (req, res) => {
      const { params } = req;

      if (!params[paramKey]) {
        res.send({
          status: "error",
          message: `Your endpoint should have a param with key ${"'"}${paramKey}${"'"}, currently it looks like this: ${endpoint}`,
        });
        return;
      }

      const key = params[paramKey];

      ref
        .doc(key)
        .get()
        .then((doc) => {
          if (!doc.exists) {
            res.send({
              status: "error",
              message: `No document with id ${key} found in collection ${collection}`,
            });
            return;
          }

          res.send({
            status: "success",
            data: {
              id: doc.id,
              ...doc.data(),
            },
          });
        })
        .catch((error) => {
          res.send({
            status: "error",
            message: error.message,
          });

          return;
        });
    });
  }

  addSimpleGetAction(collection, endpoint, app) {
    const ref = this.db.collection(collection);
    this.executeGetQuery(ref, endpoint, app);
  }

  async executeGetQuery(ref, endpoint, app) {
    app.get(endpoint, (req, res) => {
      ref.get().then((snapshot) => {
        const data = [];
        snapshot.forEach((doc) => {
          data.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        res.send({
          status: "success",
          data,
        });
      });
    });
  }

  addPostAction(collection, endpoint) {
    this.app.post(endpoint, (req, res) => {
      if (
        checkIfBodyHasDifferentKeys(
          req.body,
          this.collections[collection].documentAttributes
        )
      ) {
        const extraKeys = Object.keys(req.body).filter(
          (key) =>
            !this.collections[collection].documentAttributes.includes(key)
        );
        res.send({
          status: "ERROR",
          message: `Don't use these keys: ${extraKeys.join(
            ", "
          )}: they are not in the schema`,
        });
        return;
      }

      const ref = this.db.collection(collection);
      const documentAttributes =
        this.collections[collection].documentAttributes;

      if (!checkIfBodyHasAllKeys(req.body, documentAttributes)) {
        const missedKeys = getMissingKeys(req.body, documentAttributes);

        res.send({
          status: "ERROR",
          message: `Missed keys: ${missedKeys.join(", ")}`,
        });
        return;
      }

      ref
        .add(req.body)
        .then((docRef) => {
          res.send({
            status: "success",
            data: {
              id: docRef.id,
            },
          });
        })
        .catch((error) => {
          res.send({
            status: "error",
            message: error.message,
          });
        });
    });
  }

  addDeleteAction(collection, endpoint, request) {
    this.app.delete(endpoint, (req, res) => {
      const { params } = req;
      const { paramKey } = request;

      if (!params[paramKey]) {
        res.send({
          status: "error",
          message: `Your endpoint should have a param with key ${"'"}${paramKey}${"'"}, currently it looks like this: ${endpoint}`,
        });
        return;
      }

      const key = params[paramKey];
      const ref = this.db.collection(collection);

      ref
        .doc(key)
        .delete()
        .then(() => {
          res.send({
            status: "success",
            message: `Document with id ${key} was deleted`,
          });
        })
        .catch((error) => {
          res.send({
            status: "error",
            message: error.message,
          });
        });
    });
  }

  addPutAction(collection, endpoint, request) {
    this.app.put(endpoint, (req, res) => {
      const { params } = req;
      const { paramKey } = request;
      const key = params[paramKey];
      const ref = this.db.collection(collection);
      const documentAttributes =
        this.collections[collection].documentAttributes;

      if (!params[paramKey]) {
        res.send({
          status: "error",
          message: `Your endpoint should have a param with key ${"'"}${paramKey}${"'"}, currently it looks like this: ${endpoint}`,
        });
        return;
      }

      if (
        checkIfBodyHasDifferentKeys(
          req.body,
          this.collections[collection].documentAttributes
        )
      ) {
        const extraKeys = Object.keys(req.body).filter(
          (key) =>
            !this.collections[collection].documentAttributes.includes(key)
        );
        res.send({
          status: "ERROR",
          message: `Don't use these keys: ${extraKeys.join(
            ", "
          )}: they are not in the schema`,
        });
        return;
      }

      if (!checkIfBodyHasAllKeys(req.body, documentAttributes)) {
        const missedKeys = getMissingKeys(req.body, documentAttributes);

        res.send({
          status: "ERROR",
          message: `Missed keys: ${missedKeys.join(", ")}`,
        });
        return;
      }

      ref
        .doc(key)
        .set(req.body)
        .then(() => {
          res.send({
            status: "success",
            message: `Document with id ${key} was updated`,
          });
        })
        .catch((error) => {
          res.send({
            status: "error",
            message: error.message,
          });
        });
    });
  }

  addPatchAction(collection, endpoint, request) {
    this.app.patch(endpoint, (req, res) => {
      const { params } = req;
      const { paramKey } = request;
      const newBody = {};
      const key = params[paramKey];
      const ref = this.db.collection(collection);

      Object.keys(req.body).forEach((key) => {
        if (req.body[key]) {
          newBody[key] = req.body[key];
        }
      });

      const bodyHasAtLeastOneKey = this.collections[
        collection
      ].documentAttributes.some((key) => newBody[key]);

      if (!bodyHasAtLeastOneKey) {
        res.send({
          status: "error",
          message: `Your request body must have at least one key from documentAttributes: ${this.collections[
            collection
          ].documentAttributes.join(", ")}`,
        });
        return;
      }

      if (
        checkIfBodyHasDifferentKeys(
          req.body,
          this.collections[collection].documentAttributes
        )
      ) {
        const extraKeys = Object.keys(req.body).filter(
          (key) =>
            !this.collections[collection].documentAttributes.includes(key)
        );
        res.send({
          status: "ERROR",
          message: `Don't use these keys: ${extraKeys.join(
            ", "
          )}: they are not in the schema`,
        });
        return;
      }

      if (!params[paramKey]) {
        res.send({
          status: "error",
          message: `Your endpoint should have a param with key ${"'"}${paramKey}${"'"}, currently it looks like this: ${endpoint}`,
        });
        return;
      }

      ref
        .doc(key)
        .update(req.body)
        .then(() => {
          res.send({
            status: "success",
            message: `Document with id ${key} was updated`,
          });
        })
        .catch((error) => {
          res.send({
            status: "error",
            message: error.message,
          });
        });
    });
  }

  appListen({ port, app }) {
    app.listen(port, () => {
      console.log(`Express app listening at http://localhost:${port}`);
    });
  }
}

module.exports = FirebaseExpressSDK;
