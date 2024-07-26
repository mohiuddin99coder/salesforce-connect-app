import { GraphqlQueryError } from "@shopify/shopify-api";
import shopify from "./shopify.js";

export default async function createObject(session,inputQuery,inputVariables) {

    const client = new shopify.api.clients.Graphql({ session });

    try {
        const metaobject = await client.query({
            data: {
                query: inputQuery,
                variables: inputVariables
            },
        });
        return metaobject;
    } catch (error) {
        if (error instanceof GraphqlQueryError) {
            throw new Error(
                `${error.message}\n${JSON.stringify(error.response, null, 2)}`
            );
        } else {
            throw error;
        }
    }
}

