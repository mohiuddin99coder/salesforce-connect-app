import { DeliveryMethod } from "@shopify/shopify-api";
import axios from 'axios';
import shopify from './shopify.js';
import { gql } from 'graphql-tag';
import { GraphQLClient } from 'graphql-request';

/**
 * @type {{[key: string]: import("@shopify/shopify-api").WebhookHandler}}
 */
export default {

  CUSTOMERS_DATA_REQUEST: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
    },
  },
  
  CUSTOMERS_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
    },
  },

  SHOP_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
    },
  },

  PRODUCTS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
    }
  },
  CUSTOMERS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
      console.log('Customer Creation Payload: ', payload);

      const session = await getShopifySession(shop);
      const sessionAccessToken = session.accessToken;

      const queryAccount = await getSalesforceAccountId(payload,shop,sessionAccessToken);

      if(queryAccount == null) {
        const account = await createAccount(payload,shop,sessionAccessToken); 
      }
    }
  },
  ORDER_TRANSACTIONS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
      console.log('ORDER_TRANSACTIONS_CREATE Payload: ',payload);

      if(payload.kind == 'authorization') {

        const session = await getShopifySession(shop);
        const sessionAccessToken = session.accessToken;

        const webhookType = 'transaction';
        const queryPaymentAuthorization = await getPaymentAuthorization(payload,shop,sessionAccessToken,webhookType);
        
        if(queryPaymentAuthorization == null) {
          const paymentMethod = await createPaymentMethod(payload,shop,sessionAccessToken);
          const paymentAuthorization = await createPaymentAuthorization(paymentMethod,payload,shop,sessionAccessToken);
          const paymentGatewayLog = createPaymentGatewayLog(paymentAuthorization,payload,shop,sessionAccessToken);
        }
      }
    },
  },
  ORDERS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
      console.log('Order Creation Payload: ', payload);
      
      const session = await getShopifySession(shop);
      const sessionAccessToken = session.accessToken;

      const queryOrder = await getOrderId(payload,shop,sessionAccessToken);

      if(queryOrder == null) {
        const order = await createOrder(payload,shop,sessionAccessToken); 
      }
    }
  }
};

// Function to get session from storage
async function getShopifySession(shop) {
  try {
    const sessionId = shopify.api.session.getOfflineId(shop);
    return await shopify.config.sessionStorage.loadSession(sessionId);
  } catch (error) {
    console.error(`Error loading session for shop ${shop}: ${error.message}`);
    throw error;
  }
}

// Function to fetch Salesforce credentials from the metaobject
async function fetchSalesforceCredentialsfromShopifyStore(shop, sessionAccessToken) {
  try {
    const client = new GraphQLClient(`https://${shop}/admin/api/2023-07/graphql.json`, {
      headers: {
        'X-Shopify-Access-Token': sessionAccessToken,
      },
    });

    const query = gql`
    query {
      metaobjects(type: "salesforce_credentials", first: 1,reverse:true, sortKey: "updated_at") {
        edges {
          node {
            id
            fields {
              key
              value
            }
          }
        }
      }
    }
  `;

    let data = await client.request(query);
    const fields = data.metaobjects.edges[0].node.fields;
    const credentials = fields.reduce((acc, field) => {
      acc[field.key] = field.value;
      return acc;
    }, {});

    return credentials;
  } catch (error) {
    console.log('Error Fetching Salesforce credentials: ', error);
  }

}

// Function to get access token
async function getSalesforceAccessToken(shop, sessionAccessToken) {
  try {
    const salesforce_credentials = await fetchSalesforceCredentialsfromShopifyStore(shop, sessionAccessToken);
    const response = await axios.post(`${salesforce_credentials.instance_url}/services/oauth2/token`, null, {
      params: {
        grant_type: 'client_credentials',
        client_id: `${salesforce_credentials.client_id}`,
        client_secret: `${salesforce_credentials.client_secret}`,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return {
      accessToken: response.data.access_token,
      instanceUrl: response.data.instance_url
    };

  } catch (error) {
    console.error('Error getting access token:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function salesforceGetRequest(sObject,query,shop,sessionAccessToken) {

  try {
    const { accessToken, instanceUrl } = await getSalesforceAccessToken(shop, sessionAccessToken);
    const response = await axios.get(`${instanceUrl}/services/data/v60.0/query`, {
      params: {
        q:query
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (response.data.records.length > 0) {
      //console.log(`${sObject} Query Data: `,response.data.records);
      return response.data.records;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error quering ${sObject} records: `, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function salesforcePostRequest(sObject,body,shop,sessionAccessToken) {
  try{
  const { accessToken, instanceUrl } = await getSalesforceAccessToken(shop, sessionAccessToken);
    const response = await axios.post(`${instanceUrl}/services/data/v60.0/sobjects/${sObject}`,body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    //console.log(`${sObject} Created Successfully: `,response.data);
    console.log(`${sObject} Created Successfully: `);
    return response.data.id;
  } catch (error) {
    console.error(`Error creating ${sObject} :`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function salesforcePatchRequest(sObject,recordId,body,shop,sessionAccessToken) {
  try{
  const { accessToken, instanceUrl } = await getSalesforceAccessToken(shop, sessionAccessToken);
    const response = await axios.patch(`${instanceUrl}/services/data/v60.0/sobjects/${sObject}/${recordId}`,body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`${sObject} Updated Successfully: `,response.data);
    return response.data;
  } catch (error) {
    console.error(`Error Updating ${sObject} :`, error.response ? error.response.data : error.message);
    throw error;
  }
}

// Function to get PersonAccount RecordTypeId
async function getPersonAccountRecordTypeId(shop,sessionAccessToken) {

  const sObject = 'RecordType';
  let query = `SELECT Id FROM RecordType WHERE DeveloperName = 'PersonAccount' LIMIT 1`
  const salesforceRecordType = await salesforceGetRequest(sObject,query,shop,sessionAccessToken);
  if(salesforceRecordType != null && salesforceRecordType.length > 0) {
    const recordTypeId = salesforceRecordType[0].Id;
    return recordTypeId;
  } else {
    return null;
  }
}

// Function to get Pricebook Id
async function getPricebookId(shop,sessionAccessToken) {

  const sObject = 'Pricebook2';
  let query = `SELECT Id, Name, IsActive FROM Pricebook2 WHERE Name = 'Shopify Price Book' AND IsActive = true`
  const salesforcePricebook = await salesforceGetRequest(sObject,query,shop,sessionAccessToken);
  if(salesforcePricebook != null && salesforcePricebook.length > 0) {
    const pricebookId = salesforcePricebook[0].Id;
    return pricebookId;
  } else {
    return null;
  }
}

// Function to check whether the Customer already exist
async function getSalesforceAccountId(payload, shop, sessionAccessToken) {

  const sObject = 'Account';
  let query = `SELECT Id FROM Account WHERE OMSQS_Shopify_Customer_Id__c = '${payload.id}'`
  const salesforceAccount = await salesforceGetRequest(sObject,query,shop,sessionAccessToken);
  if(salesforceAccount != null && salesforceAccount.length > 0) {
    const accountId = salesforceAccount[0].Id;
    return accountId;
  } else {
    return null;
  }
}

// Function to get ProductId
async function getProductId(SKU,shop,sessionAccessToken) {

  const sObject = 'Product2';
  let query = `SELECT Id, Name, StockKeepingUnit FROM Product2 WHERE StockKeepingUnit = '${SKU}'`
  const salesforceProduct = await salesforceGetRequest(sObject,query,shop,sessionAccessToken);
  if(salesforceProduct != null && salesforceProduct.length > 0) {
    const productId = salesforceProduct[0].Id;
    return productId;
  } else {
    return null;
  }
}

// Function to get ProductId
async function getPricebookEntryId(SKU,pricebookId,shop, sessionAccessToken) {

  const sObject = 'PricebookEntry';
  let query = `SELECT Id, Name, ProductCode, Pricebook2Id, IsActive 
        FROM PricebookEntry 
        WHERE ProductCode = '${SKU}' 
        AND Pricebook2Id = '${pricebookId}' 
        AND IsActive = true LIMIT 1`
  const salesforcePricebookEntry = await salesforceGetRequest(sObject,query,shop,sessionAccessToken);
  if(salesforcePricebookEntry != null && salesforcePricebookEntry.length > 0) {
    const pricebookEntryId = salesforcePricebookEntry[0].Id;
    return pricebookEntryId;
  } else {
    return null;
  }
}

// Function to check whether the Customer already exist
async function getPaymentAuthorization(payload,shop,sessionAccessToken,webhookType) {

  let shopName = shop.split('.myshopify.com')[0];
  let orderId;
  if(webhookType == 'transaction') {
    orderId = payload.order_id;
  } else if(webhookType == 'orderCreate') {
    orderId = payload.id;
  }

  const sObject = 'PaymentAuthorization';
  let query = `SELECT Id,OMSQS_Shopify_Order_Id__c,OMSQS_Shopify_Store_Name__c,PaymentMethodId,AccountId,PaymentGroupId 
                FROM PaymentAuthorization 
                WHERE OMSQS_Shopify_Order_Id__c = '${orderId}' AND OMSQS_Shopify_Store_Name__c = '${shopName}'`

  const salesforcePaymentAuthorization = await salesforceGetRequest(sObject,query,shop,sessionAccessToken);
  if(salesforcePaymentAuthorization != null && salesforcePaymentAuthorization.length > 0) {
    const paymentAuthorization = salesforcePaymentAuthorization[0];
    return paymentAuthorization;
  } else {
    return null;
  }
}

async function getPaymentMethod(paymentAuthorization,shop,sessionAccessToken) {

  const sObject = 'CardPaymentMethod';
  let query = `SELECT Id,AccountId,PaymentMethodStreet,PaymentMethodCity,PaymentMethodStateCode,PaymentMethodPostalCode,PaymentMethodCountryCode
                FROM CardPaymentMethod 
                WHERE Id = '${paymentAuthorization.PaymentMethodId}'`

  const salesforcePaymentMethod = await salesforceGetRequest(sObject,query,shop,sessionAccessToken);
  if(salesforcePaymentMethod != null && salesforcePaymentMethod.length > 0) {
    const paymentMethod = salesforcePaymentMethod[0];
    return paymentMethod;
  } else {
    return null;
  }
}


async function getOrderId(payload,shop,sessionAccessToken) {

  let shopName = shop.split('.myshopify.com')[0];

  const sObject = 'Order';
  let query = `SELECT Id,OMSQS_Shopify_Id__c,OMSQS_Shopify_Store_Name__c 
                FROM Order 
                WHERE OMSQS_Shopify_Id__c = '${payload.id}' AND OMSQS_Shopify_Store_Name__c = '${shopName}'`

  const salesforceOrder = await salesforceGetRequest(sObject,query,shop,sessionAccessToken);
  if(salesforceOrder != null && salesforceOrder.length > 0) {
    const orderId = salesforceOrder[0].Id;
    return orderId;
  } else {
    return null;
  }
}

// Function to create an Account in Salesforce
async function createAccount(payload,shop,sessionAccessToken) {

  // Retrieve the RecordTypeId for Person Account
  const recordTypeId = await getPersonAccountRecordTypeId(shop,sessionAccessToken);

  const accountData = {
    FirstName: payload.first_name,
    LastName: payload.last_name,
    PersonEmail: payload.email,
    Phone: payload.phone,
    RecordTypeId: recordTypeId,
    OMSQS_Shopify_Customer_Id__c: payload.id
  };

  const sObject = 'Account';
  const account = await salesforcePostRequest(sObject,accountData,shop,sessionAccessToken);
  //console.log('Account: ',account);
  return account;
}

// Function to create an Order
async function createOrder(payload,shop,sessionAccessToken) {

  const queryAccount = await getSalesforceAccountId(payload.customer,shop,sessionAccessToken);
  let accountId;
  if(queryAccount == null) {
    const account = await createAccount(payload.customer,shop,sessionAccessToken);
    accountId =  account;
  } else {
    accountId = queryAccount;
  }
  const pricebookId = await getPricebookId(shop, sessionAccessToken);

  let shopName = shop.split('.myshopify.com')[0];
  let billingStateCode;
  let shippingStateCode;

  if(payload.billing_address.province_code == 'TS') {
    billingStateCode = 'TG';
  } else {
    billingStateCode = payload.billing_address.province_code;
  }
  if(payload.shipping_address.province_code == 'TS') {
    shippingStateCode = 'TG';
  } else {
    shippingStateCode = payload.shipping_address.province_code;
  }

  const orderData = {
    AccountId: accountId,
    EffectiveDate: new Date(),
    Status: 'Draft',
    Pricebook2Id: pricebookId,
    OMSQS_Shopify_Id__c: payload.id,
    OMSQS_Shopify_Order_Number__c: payload.order_number,
    OMSQS_Shipping_Method__c: payload.shipping_lines[0].code,
    OMSQS_Shopify_Store_Name__c: shopName,
    BillingCountryCode: payload.billing_address.country_code,
    BillingStateCode: billingStateCode,
    BillingCity: payload.billing_address.city,
    BillingStreet: payload.billing_address.address1,
    BillingPostalCode: payload.billing_address.zip,
    ShippingCountryCode: payload.shipping_address.country_code,
    ShippingStateCode: shippingStateCode,
    ShippingCity: payload.shipping_address.city,
    ShippingStreet: payload.shipping_address.address1,
    ShippingPostalCode: payload.shipping_address.zip,
  }

  const sObject = 'Order';
  const order = await salesforcePostRequest(sObject,orderData,shop,sessionAccessToken);
  //console.log('Order: ',order);

  let isShippingLineItem = false;
  const shopifyLineItems = payload.line_items;
  const orderItems = await createOrderItems(order,pricebookId,shopifyLineItems,shop,sessionAccessToken,isShippingLineItem);

  isShippingLineItem = true;
  const shopifyShippingLineItems = payload.shipping_lines;
  const orderShippingItems = await createOrderItems(order,pricebookId,shopifyShippingLineItems,shop,sessionAccessToken,isShippingLineItem);

  const webhookType = 'orderCreate';
  const paymentGroup = await createPaymentGroup(order,shop,sessionAccessToken);
  const paymentAuthorization = await getPaymentAuthorization(payload,shop,sessionAccessToken,webhookType);
  const updatePayAuth = await updatePaymentAuthorization(paymentAuthorization,paymentGroup,accountId,payload,shop,sessionAccessToken);
  const paymentMethod = await getPaymentMethod(paymentAuthorization,shop,sessionAccessToken);
  const updatePaymentMeth = await updatePaymentMethod(paymentMethod,accountId,payload,shop,sessionAccessToken);

  return order;
}


// Function to create Order LineItems
async function createOrderItems(salesforceOrderId,pricebookId,orderLineItems,shop,sessionAccessToken,isShippingLineItem) {
  try {
    orderLineItems.forEach(lineitem => {
      createOrderItem(salesforceOrderId,pricebookId,lineitem,shop,sessionAccessToken,isShippingLineItem);
    });
  } catch (error) {
    console.log('Error creating Order Line Items: ', error.response ? error.response.data : error.message);
  }
}

// Function to create a LineItem
async function createOrderItem(salesforceOrderId,pricebookId,lineitem,shop,sessionAccessToken,isShippingLineItem) {
  let SKU;
  let requestedQuantity;
  let lineItemPrice;
  let orderType;
  if(isShippingLineItem == true) {
    SKU = lineitem.code;
    requestedQuantity = 1;
    lineItemPrice = parseFloat(lineitem.price);
    orderType = 'Delivery Charge'
  } else {
    SKU = lineitem.sku;
    requestedQuantity = parseInt(lineitem.quantity);
    lineItemPrice = parseFloat(lineitem.price);
    orderType = 'Order Product'
  }
  const productId = await getProductId(SKU, shop, sessionAccessToken);
  const pricebookEntryId = await getPricebookEntryId(SKU,pricebookId,shop,sessionAccessToken);
  const orderItemData = {
    OrderId: salesforceOrderId,
    Product2Id: productId,
    Quantity: requestedQuantity,
    UnitPrice: lineItemPrice,
    PricebookEntryId: pricebookEntryId,
    Type: orderType,
    TotalLineAmount: lineItemPrice,
    OMSQS_Shopify_Line_Item_Id__c:lineitem.id
  };

  const sObject = 'OrderItem';
  const orderItem = await salesforcePostRequest(sObject,orderItemData,shop,sessionAccessToken);
  //console.log('OrderItem: ',orderItem);

  if(lineitem.tax_lines.length > 0) {
    const orderItemTaxLineItem = createOrderItemTaxLineItem(orderItem,lineitem,shop,sessionAccessToken);
  }
  const lineitemDiscount = parseFloat(lineitem.total_discount);
  if(lineitemDiscount > 0) {
    const discountName = `${lineitem.title} Adjustment`;
    const orderItemAdjustmentLineItem = createOrderItemAdjustmentLineItem(orderItem,lineitemDiscount,discountName,shop,sessionAccessToken);
  }

  return orderItem;
}

async function createOrderItemTaxLineItem(orderItem,lineitem,shop,sessionAccessToken) {

  const taxLines = lineitem.tax_lines;
  try {
    taxLines.forEach(taxline => {
      createTaxItem(taxline,orderItem,shop,sessionAccessToken);
    });
  } catch (error) {
    console.log('Error creating Tax Line Items: ', error.response ? error.response.data : error.message);
  }
}

async function createTaxItem(taxline,orderItem,shop,sessionAccessToken) {

  const orderItemTaxLineItemData = {
    Amount: parseFloat(taxline.price),
    Name: taxline.title,
    OrderItemId: orderItem,
    Rate: parseFloat(taxline.rate),
    TaxEffectiveDate: new Date(),
    Type: 'Actual'
  };

  const sObject = 'OrderItemTaxLineItem';
  const orderItemTaxLineItem = await salesforcePostRequest(sObject,orderItemTaxLineItemData,shop,sessionAccessToken);
  //console.log('OrderItemTaxLineItem: ',orderItemTaxLineItem);
  return orderItemTaxLineItem;
}

async function createOrderItemAdjustmentLineItem(orderItem,lineitemDiscount,discountName,shop,sessionAccessToken) {

  const orderItemAdjustmentLineItemData = {
    Amount: -parseFloat(lineitemDiscount),
    Name: discountName,
    OrderItemId: orderItem
  };

  const sObject = 'OrderItemAdjustmentLineItem';
  const orderItemAdjustmentLineItem = await salesforcePostRequest(sObject,orderItemAdjustmentLineItemData,shop,sessionAccessToken);
  //console.log('OrderItemAdjustmentLineItem: ',orderItemAdjustmentLineItem);
  return orderItemAdjustmentLineItem; 
}

// Function to create an Order
async function createPaymentMethod(payload,shop,sessionAccessToken) {

  let cardType;
  if(payload.payment_details.credit_card_company == 'Mastercard') {
    cardType = 'Master Card';
  } else if(payload.payment_details.credit_card_company == 'Visa') {
    cardType = 'Visa';
  }
  const paymentMethodData = {
    CardCategory: 'CreditCard',
    CardHolderName: payload.payment_details.credit_card_name,
    CardLastFour: payload.payment_details.credit_card_number.slice(-4),
    CardType: cardType,
    InputCardNumber: '************'+payload.payment_details.credit_card_number.slice(-4),
    ExpiryMonth: payload.payment_details.credit_card_expiration_month,
    ExpiryYear: payload.payment_details.credit_card_expiration_year,
    OMSQS_Payment_Gateway__c: payload.gateway,
    Status: 'InActive',
    ProcessingMode: 'External'
  };

  const sObject = 'CardPaymentMethod';
  const paymentMethod = await salesforcePostRequest(sObject,paymentMethodData,shop,sessionAccessToken);
  //console.log('CardPaymentMethod: ',paymentMethod);
  return paymentMethod;
}

async function createPaymentAuthorization(paymentMethod,payload,shop,sessionAccessToken) {

  let shopName = shop.split('.myshopify.com')[0];
  const paymentAuthorizationData = {
    Amount: parseFloat(payload.amount),
    Status: 'Processed',
    Date: new Date(),
    PaymentMethodId: paymentMethod,
    ProcessingMode: 'External',
    GatewayDate: new Date(),
    EffectiveDate: new Date(),
    GatewayRefNumber: payload.receipt.requestID,
    GatewayAuthCode: payload.receipt.authorizationCode,
    GatewayResultCode: payload.receipt.reasonCode,
    GatewayResultCodeDescription: payload.receipt.message,
    OMSQS_Payment_Gateway__c: payload.gateway,
    OMSQS_Shopify_Transaction_Id__c: payload.id,
    OMSQS_Shopify_Order_Id__c: payload.order_id,
    OMSQS_Shopify_Store_Name__c: shopName
  };

  const sObject = 'PaymentAuthorization';
  const paymentAuthorization = await salesforcePostRequest(sObject,paymentAuthorizationData,shop,sessionAccessToken);
  //console.log('PaymentAuthorization: ',paymentAuthorization);
  return paymentAuthorization;
}

async function createPaymentGatewayLog(paymentAuthorization,payload,shop,sessionAccessToken) {

  const paymentGatewayLogData = {
    GatewayAuthCode: payload.receipt.authorizationCode,
    GatewayAvsCode: payload.receipt.avsCode,
    InteractionType: 'Authorization',
    GatewayDate: new Date(),
    GatewayMessage: payload.receipt.message,
    GatewayRefNumber: payload.receipt.requestID,
    GatewayResultCode: payload.receipt.reasonCode,
    GatewayResultCodeDescription: payload.receipt.requestID,
    InteractionStatus: 'Success',
    ReferencedEntityId: paymentAuthorization
  };

  const sObject = 'PaymentGatewayLog';
  const paymentGatewayLog = await salesforcePostRequest(sObject,paymentGatewayLogData,shop,sessionAccessToken);
  //console.log('PaymentGatewayLog: ',paymentGatewayLog);
  return paymentGatewayLog;
}

async function createPaymentGroup(order,shop,sessionAccessToken) {
  
  const paymentGroupData = {
    SourceObjectId: order
  }

  const sObject = 'PaymentGroup';
  const paymentGroup = await salesforcePostRequest(sObject,paymentGroupData,shop,sessionAccessToken);
  //console.log('PaymentGroup: ',paymentGroup);
  return paymentGroup;
}

async function updatePaymentAuthorization(paymentAuthorization,paymentGroup,salesforceAccountId,payload,shop,sessionAccessToken) {

  const paymentAuthorizationData = {
    AccountId: salesforceAccountId,
    PaymentGroupId: paymentGroup,
  }

  const sObject = 'PaymentAuthorization';
  const payAuth = await salesforcePatchRequest(sObject,paymentAuthorization.Id,paymentAuthorizationData,shop,sessionAccessToken);

  return payAuth;
}

async function updatePaymentMethod(paymentMethod,salesforceAccountId,payload,shop,sessionAccessToken) {

  const paymentMethodData = {
    AccountId: salesforceAccountId,
    Status: 'Active',
    PaymentMethodStreet: payload.billing_address.address1,
    PaymentMethodCity: payload.billing_address.city,
    PaymentMethodStateCode: payload.billing_address.province_code,
    PaymentMethodPostalCode: payload.billing_address.zip,
    PaymentMethodCountryCode: payload.billing_address.country_code
  }

  const sObject = 'CardPaymentMethod';
  const payMeth = await salesforcePatchRequest(sObject,paymentMethod.Id,paymentMethodData,shop,sessionAccessToken);

  return payMeth;
}