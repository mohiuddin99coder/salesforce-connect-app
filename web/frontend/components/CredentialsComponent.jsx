import React,{ useState, useEffect, useRef } from "react";
import { useAuthenticatedFetch } from "../hooks";
import Loader from "react-js-loader";
import "./index.css";

export function CredentialsComponent() {

    let fetch = useAuthenticatedFetch();
    const [isSalesforceConnected, setSalesforce] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [shouldRenderUser, setShouldRenderUser] = useState(false);
    const primaryColor = "#016356";
    const backgroundColor = "#4b6d68";

    useEffect(() => {
        checkSalesforceOrgConnected();
    }, []);

    useEffect(() => {
        if (isSalesforceConnected) {
            setIsLoading(true);
            // Delay rendering SalesforceUser component by 30 seconds
            const timer = setTimeout(() => {
                setIsLoading(false);
                setShouldRenderUser(true);
            }, 10000); // 30 seconds

            return () => {
                clearTimeout(timer);
            }; // Clean up timer on component unmount
        }
    }, [isSalesforceConnected]);


    async function checkSalesforceOrgConnected() {

        const metaObject = await fetchSalesforceCredentials(fetch);
        if (metaObject != null) {
            const fields = metaObject.fields;
            const credentials = fields.reduce((acc, field) => {
                acc[field.key] = field.value;
                return acc;
            }, {});
            if (credentials != null && credentials.instance_url != null &&
                credentials.client_id != null && credentials.client_secret != null) {
                setSalesforce(true);
            } else {
                setIsLoading(false);
            }
        } else if (metaObject == null) {

            const metaObjectDefinition = await fetchMetaobjectDefinition(fetch);

            if (metaObjectDefinition == null) {
                const creatDefinition = await createMetaObjectDefinition(fetch);
            }
            setIsLoading(false);
        }
    }


    if (isLoading) {
        return <div className="loader">
            <div className="spinner">
                <Loader type="spinner-cub" bgColor={backgroundColor} color={primaryColor} size={70} />;
            </div>
        </div>
    } else if (shouldRenderUser) {
        return <SalesforceUser onSubmit={() => {
            setSalesforce(false);
            setShouldRenderUser(false);
            console.log("In My Component:");
        }} />;
    } else if (isLoading == false && shouldRenderUser == false && isSalesforceConnected == false) {
        return <LoginSalesforce onSubmit={() => setSalesforce(true)} />;
    }
}


function LoginSalesforce({ onSubmit }) {

    let fetch = useAuthenticatedFetch();
    const [inputs, setInputs] = useState({});
    const submitBtnRef = useRef(null);

    useEffect(() => {
        if (submitBtnRef.current) {
            submitBtnRef.current.disabled = true;
        }
    }, []);

    useEffect(() => {
        const isFormValid = inputs.instanceUrl?.length >= 10 && inputs.clientId?.length >= 10 && inputs.clientSecret?.length >= 10;
        if (submitBtnRef.current) {
            submitBtnRef.current.disabled = !isFormValid;
        }
    }, [inputs]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setInputs(values => ({ ...values, [name]: value }))
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        console.log(inputs);
        handleInputs(fetch, inputs);
        onSubmit();
        setInputs({});
    }
    return (
        <div className="form-container">
            <div className="inputs-container">
                <form onSubmit={handleSubmit}>
                    <div className="instance-url">
                        <label>Instance Url:
                            <input
                                type="text"
                                name="instanceUrl"
                                value={inputs.instanceUrl || ""}
                                onChange={handleChange}
                            />
                        </label>
                    </div>
                    <div className="client-id">
                        <label>Client Id:
                            <input
                                type="password"
                                name="clientId"
                                value={inputs.clientId || ""}
                                onChange={handleChange}
                            />
                        </label>
                    </div>
                    <div className="client-secret">
                        <label>Client Secret:
                            <input
                                type="password"
                                name="clientSecret"
                                value={inputs.clientSecret || ""}
                                onChange={handleChange}
                            />
                        </label>
                    </div>
                    <div className="submit">
                        <input type="submit" className='submit-btn' value="Submit" ref={submitBtnRef} />
                    </div>
                </form>
            </div>
        </div>
    )
}

async function handleInputs(fetch, inputs) {

    const metaObject = await fetchSalesforceCredentials(fetch);
    console.log('metaObject: ', metaObject);

    if (metaObject != null) {
        const storeCredentials = await storeSalesforceCredentials(fetch, inputs);
    } else if (metaObject == null) {
        console.log('In handleInputs: Metaobject not Exist: ');
        createMetaObject(fetch, inputs);
    }
}

function SalesforceUser({ onSubmit }) {

    let fetch = useAuthenticatedFetch();
    let [instanceUrl, setInstanceUrl] = useState("");
    let [clientId, setClientId] = useState("");
    let [clientSecret, setClientSecret] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const modalRef = useRef(null);
    const primaryColor = "#016356";
    const backgroundColor = "#4b6d68";

    useEffect(() => {
        displayCredentials();
    }, []);

    const handleSubmit = (event) => {
        event.preventDefault();
        setIsModalOpen(true);
    }
    const handleCloseModal = () => {
        setIsModalOpen(false);
    }
    const handleReset = () => {
        onSubmit();
        setIsModalOpen(false);
    }

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                setIsModalOpen(false);
            }
        };
        if (isModalOpen) {
            window.addEventListener('click', handleOutsideClick);
        } else {
            window.removeEventListener('click', handleOutsideClick);
        }
        return () => {
            window.removeEventListener('click', handleOutsideClick);
        };
    }, [isModalOpen]);

    async function displayCredentials() {

        console.log('In displayCredentials: ');

        const metaObject = await fetchSalesforceCredentials(fetch);
        if (metaObject != null) {
            const fields = metaObject.fields;
            const credentials = fields.reduce((acc, field) => {
                acc[field.key] = field.value;
                return acc;
            }, {});
            if (credentials != null && credentials.instance_url != null &&
                credentials.client_id != null && credentials.client_secret != null) {
                setInstanceUrl(credentials.instance_url);
                setClientId(credentials.client_id);
                setClientSecret(credentials.client_secret);

            }
        }
        setIsLoading(false);
    }

    if (isLoading) {
        return <div className="loader">
            <div className="spinner">
                <Loader type="spinner-cub" bgColor={backgroundColor} color={primaryColor} size={70} />;
            </div>
        </div>
    } else {
        return (
            <div className="form-container">
                <div className="inputs-container">
                    <form onSubmit={handleSubmit}>
                        <div className="instance-url">
                            <label>Instance Url:
                                <input
                                    type="text"
                                    name="instanceUrl"
                                    defaultValue={instanceUrl}
                                    readOnly
                                />
                            </label>
                        </div>
                        <div className="client-id">
                            <label>Client Id:
                                <input
                                    type="password"
                                    name="clientId"
                                    defaultValue={clientId}
                                    readOnly
                                />
                            </label>
                        </div>
                        <div className="client-secret">
                            <label>Client Secret:
                                <input
                                    type="password"
                                    name="clientSecret"
                                    defaultValue={clientSecret}
                                    readOnly
                                />
                            </label>
                        </div>
                        <div className="submit">
                            <input type="submit" className='reset-btn' value="Reset" />
                        </div>
                    </form>
                </div>
                {isModalOpen && (
                    <div id="myModal" className="modal" ref={modalRef}>
                        <div className="modal-content">
                            <div className="modal-message">
                                <p>Are you sure! you want to Reset the Salesforce Credentials</p>
                            </div>
                            <div className="modal-control">
                                <button className="close" onClick={handleCloseModal}>Cancel</button>
                                <button className='confirm' onClick={handleReset}>Confirm</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }
}

async function fetchSalesforceCredentials(fetch) {
    try {
        const req = await fetch("/api/metaobjects", {
            method: "GET"
        });
        let response = await req.json();
        console.log('Salesforce Credentials Data: ', response);
        if (response.body.data.metaobjects.edges.length > 0) {
            const metaObject = response.body.data.metaobjects.edges[0].node;
            console.log('MetaObject: ', metaObject);
            return metaObject;
        } else {
            console.log('In getSalesforceCredentials: MetaObject not Exist: ', response);
            return null;
        }

    } catch (error) {
        console.log('Error Fetching MetaObject: ', error);
        return null;
    }
}

async function fetchMetaobjectDefinition(fetch) {
    try {
        const req = await fetch("/api/metaobjectDefinitions", {
            method: "GET"
        });
        let response = await req.json();
        console.log('Mtaobject Definition Data: ', response);
        if (response.body.data.metaobjectDefinitionByType != null) {
            const metaobjectDefinitionByTypeId = response.body.data.metaobjectDefinitionByType.id;
            console.log('metaobjectDefinitionByTypeId: ', metaobjectDefinitionByTypeId);
            return metaobjectDefinitionByTypeId;
        } else {
            console.log('In getSalesforceCredentials: MetaObject Definition not Exist: ', response);
            return null;
        }

    } catch (error) {
        console.log('Error Fetching MetaObject: ', error);
        return null;
    }
}

async function storeSalesforceCredentials(fetch, inputs) {

    console.log('In storeSalesforceCredentials Function: ');

    const metaObject = await getSalesforceCredentials(fetch);

    let query = `
    mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
            metaobject {
                handle
                instance_url: field(key: "instance_url") {
                    value
                }
                client_id: field(key: "client_id") {
                    value
                }
                client_secret: field(key: "client_secret") {
                    value
                }
            }
            userErrors {
                field
                message
                code
            }
        }
    }`;

    let variables = {
        id: metaObject.id,
        metaobject: {
            fields: [
                {
                    key: "instance_url",
                    value: inputs.instanceUrl
                },
                {
                    key: "client_id",
                    value: inputs.clientId
                },
                {
                    key: "client_secret",
                    value: inputs.clientSecret
                }
            ]
        }
    }

    const req = await fetch("/api/graphql", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query, variables })
    });

    const res = req.json();
    console.log('Update Response: ', res);
}

async function createMetaObjectDefinition(fetch) {

    let query = `
    mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition {
                name type 
                fieldDefinitions {
                    name 
                    key 
                }
            }
            userErrors {
                field
                message
                code
            }
        }
    }`;

    let variables = {
        "definition": {
            "name": "Salesforce Credentials",
            "type": "salesforce_credentials",
            "fieldDefinitions": [
                {
                    "name": "Instance Url",
                    "key": "instance_url",
                    "type": "single_line_text_field"
                },
                {
                    "name": "Client Id",
                    "key": "client_id",
                    "type": "single_line_text_field"
                },
                {
                    "name": "Client Secret",
                    "key": "client_secret",
                    "type": "single_line_text_field"
                }
            ]
        }
    }


    const req = await fetch("/api/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query, variables })
    });

    const res = req.json();
    console.log('Metadefinition Create Response: ', res);
}

async function createMetaObject(fetch, inputs) {

    let query = `
    mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
            metaobject {
                handle
                instance_url: field(key: "instance_url") {
                value
                }
                client_id: field(key: "client_id") {
                value
                }
                client_secret: field(key: "client_secret") {
                value
                }
            }
            userErrors {
                field
                message
                code
            }
        }
    }`;

    let variables = {
        metaobject: {
            type: "salesforce_credentials",
            fields: [
                {
                    key: "instance_url",
                    value: inputs.instanceUrl
                },
                {
                    key: "client_id",
                    value: inputs.clientId
                },
                {
                    key: "client_secret",
                    value: inputs.clientSecret
                }
            ]
        }
    }



    const req = await fetch("/api/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query, variables })
    });

    const res = req.json();
    console.log('MetaObject Create Response: ', res);
}