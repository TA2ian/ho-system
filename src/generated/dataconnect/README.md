# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `default`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListUsers*](#listusers)
  - [*GetUserByUid*](#getuserbyuid)
  - [*ListCustomers*](#listcustomers)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*UpdateUserRole*](#updateuserrole)
  - [*CreateCustomer*](#createcustomer)
  - [*UpdateCustomer*](#updatecustomer)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `default`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@ho-network/dataconnect` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@ho-network/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@ho-network/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has no variables.
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListUsersData {
  users: ({
    id: number;
    uid: string;
    email: string;
    name?: string | null;
    role: string;
    status: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key)[];
}
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers } from '@ho-network/dataconnect';


// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef } from '@ho-network/dataconnect';


// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## GetUserByUid
You can execute the `GetUserByUid` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
getUserByUid(vars: GetUserByUidVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByUidData, GetUserByUidVariables>;

interface GetUserByUidRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByUidVariables): QueryRef<GetUserByUidData, GetUserByUidVariables>;
}
export const getUserByUidRef: GetUserByUidRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserByUid(dc: DataConnect, vars: GetUserByUidVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByUidData, GetUserByUidVariables>;

interface GetUserByUidRef {
  ...
  (dc: DataConnect, vars: GetUserByUidVariables): QueryRef<GetUserByUidData, GetUserByUidVariables>;
}
export const getUserByUidRef: GetUserByUidRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserByUidRef:
```typescript
const name = getUserByUidRef.operationName;
console.log(name);
```

### Variables
The `GetUserByUid` query requires an argument of type `GetUserByUidVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserByUidVariables {
  uid: string;
}
```
### Return Type
Recall that executing the `GetUserByUid` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserByUidData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserByUidData {
  users: ({
    id: number;
    uid: string;
    email: string;
    name?: string | null;
    role: string;
    status: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key)[];
}
```
### Using `GetUserByUid`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserByUid, GetUserByUidVariables } from '@ho-network/dataconnect';

// The `GetUserByUid` query requires an argument of type `GetUserByUidVariables`:
const getUserByUidVars: GetUserByUidVariables = {
  uid: ..., 
};

// Call the `getUserByUid()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserByUid(getUserByUidVars);
// Variables can be defined inline as well.
const { data } = await getUserByUid({ uid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserByUid(dataConnect, getUserByUidVars);

console.log(data.users);

// Or, you can use the `Promise` API.
getUserByUid(getUserByUidVars).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `GetUserByUid`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserByUidRef, GetUserByUidVariables } from '@ho-network/dataconnect';

// The `GetUserByUid` query requires an argument of type `GetUserByUidVariables`:
const getUserByUidVars: GetUserByUidVariables = {
  uid: ..., 
};

// Call the `getUserByUidRef()` function to get a reference to the query.
const ref = getUserByUidRef(getUserByUidVars);
// Variables can be defined inline as well.
const ref = getUserByUidRef({ uid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserByUidRef(dataConnect, getUserByUidVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## ListCustomers
You can execute the `ListCustomers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listCustomers(options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, undefined>;

interface ListCustomersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCustomersData, undefined>;
}
export const listCustomersRef: ListCustomersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listCustomers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, undefined>;

interface ListCustomersRef {
  ...
  (dc: DataConnect): QueryRef<ListCustomersData, undefined>;
}
export const listCustomersRef: ListCustomersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listCustomersRef:
```typescript
const name = listCustomersRef.operationName;
console.log(name);
```

### Variables
The `ListCustomers` query has no variables.
### Return Type
Recall that executing the `ListCustomers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListCustomersData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListCustomersData {
  customers: ({
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
    status: string;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Customer_Key)[];
}
```
### Using `ListCustomers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listCustomers } from '@ho-network/dataconnect';


// Call the `listCustomers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listCustomers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listCustomers(dataConnect);

console.log(data.customers);

// Or, you can use the `Promise` API.
listCustomers().then((response) => {
  const data = response.data;
  console.log(data.customers);
});
```

### Using `ListCustomers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listCustomersRef } from '@ho-network/dataconnect';


// Call the `listCustomersRef()` function to get a reference to the query.
const ref = listCustomersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listCustomersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.customers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.customers);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation requires an argument of type `CreateUserVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserVariables {
  uid: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
}
```
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser, CreateUserVariables } from '@ho-network/dataconnect';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  uid: ..., 
  email: ..., 
  name: ..., // optional
  role: ..., 
  status: ..., 
};

// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser(createUserVars);
// Variables can be defined inline as well.
const { data } = await createUser({ uid: ..., email: ..., name: ..., role: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect, createUserVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser(createUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef, CreateUserVariables } from '@ho-network/dataconnect';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  uid: ..., 
  email: ..., 
  name: ..., // optional
  role: ..., 
  status: ..., 
};

// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef(createUserVars);
// Variables can be defined inline as well.
const ref = createUserRef({ uid: ..., email: ..., name: ..., role: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect, createUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## UpdateUserRole
You can execute the `UpdateUserRole` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
updateUserRole(vars: UpdateUserRoleVariables): MutationPromise<UpdateUserRoleData, UpdateUserRoleVariables>;

interface UpdateUserRoleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserRoleVariables): MutationRef<UpdateUserRoleData, UpdateUserRoleVariables>;
}
export const updateUserRoleRef: UpdateUserRoleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUserRole(dc: DataConnect, vars: UpdateUserRoleVariables): MutationPromise<UpdateUserRoleData, UpdateUserRoleVariables>;

interface UpdateUserRoleRef {
  ...
  (dc: DataConnect, vars: UpdateUserRoleVariables): MutationRef<UpdateUserRoleData, UpdateUserRoleVariables>;
}
export const updateUserRoleRef: UpdateUserRoleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserRoleRef:
```typescript
const name = updateUserRoleRef.operationName;
console.log(name);
```

### Variables
The `UpdateUserRole` mutation requires an argument of type `UpdateUserRoleVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserRoleVariables {
  uid: string;
  role: string;
}
```
### Return Type
Recall that executing the `UpdateUserRole` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserRoleData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserRoleData {
  user_updateMany: number;
}
```
### Using `UpdateUserRole`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUserRole, UpdateUserRoleVariables } from '@ho-network/dataconnect';

// The `UpdateUserRole` mutation requires an argument of type `UpdateUserRoleVariables`:
const updateUserRoleVars: UpdateUserRoleVariables = {
  uid: ..., 
  role: ..., 
};

// Call the `updateUserRole()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUserRole(updateUserRoleVars);
// Variables can be defined inline as well.
const { data } = await updateUserRole({ uid: ..., role: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUserRole(dataConnect, updateUserRoleVars);

console.log(data.user_updateMany);

// Or, you can use the `Promise` API.
updateUserRole(updateUserRoleVars).then((response) => {
  const data = response.data;
  console.log(data.user_updateMany);
});
```

### Using `UpdateUserRole`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserRoleRef, UpdateUserRoleVariables } from '@ho-network/dataconnect';

// The `UpdateUserRole` mutation requires an argument of type `UpdateUserRoleVariables`:
const updateUserRoleVars: UpdateUserRoleVariables = {
  uid: ..., 
  role: ..., 
};

// Call the `updateUserRoleRef()` function to get a reference to the mutation.
const ref = updateUserRoleRef(updateUserRoleVars);
// Variables can be defined inline as well.
const ref = updateUserRoleRef({ uid: ..., role: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserRoleRef(dataConnect, updateUserRoleVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_updateMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_updateMany);
});
```

## CreateCustomer
You can execute the `CreateCustomer` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
createCustomer(vars: CreateCustomerVariables): MutationPromise<CreateCustomerData, CreateCustomerVariables>;

interface CreateCustomerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCustomerVariables): MutationRef<CreateCustomerData, CreateCustomerVariables>;
}
export const createCustomerRef: CreateCustomerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createCustomer(dc: DataConnect, vars: CreateCustomerVariables): MutationPromise<CreateCustomerData, CreateCustomerVariables>;

interface CreateCustomerRef {
  ...
  (dc: DataConnect, vars: CreateCustomerVariables): MutationRef<CreateCustomerData, CreateCustomerVariables>;
}
export const createCustomerRef: CreateCustomerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createCustomerRef:
```typescript
const name = createCustomerRef.operationName;
console.log(name);
```

### Variables
The `CreateCustomer` mutation requires an argument of type `CreateCustomerVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateCustomerVariables {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: string;
}
```
### Return Type
Recall that executing the `CreateCustomer` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateCustomerData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateCustomerData {
  customer_insert: Customer_Key;
}
```
### Using `CreateCustomer`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createCustomer, CreateCustomerVariables } from '@ho-network/dataconnect';

// The `CreateCustomer` mutation requires an argument of type `CreateCustomerVariables`:
const createCustomerVars: CreateCustomerVariables = {
  name: ..., 
  email: ..., // optional
  phone: ..., // optional
  address: ..., // optional
  notes: ..., // optional
  status: ..., 
};

// Call the `createCustomer()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createCustomer(createCustomerVars);
// Variables can be defined inline as well.
const { data } = await createCustomer({ name: ..., email: ..., phone: ..., address: ..., notes: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createCustomer(dataConnect, createCustomerVars);

console.log(data.customer_insert);

// Or, you can use the `Promise` API.
createCustomer(createCustomerVars).then((response) => {
  const data = response.data;
  console.log(data.customer_insert);
});
```

### Using `CreateCustomer`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createCustomerRef, CreateCustomerVariables } from '@ho-network/dataconnect';

// The `CreateCustomer` mutation requires an argument of type `CreateCustomerVariables`:
const createCustomerVars: CreateCustomerVariables = {
  name: ..., 
  email: ..., // optional
  phone: ..., // optional
  address: ..., // optional
  notes: ..., // optional
  status: ..., 
};

// Call the `createCustomerRef()` function to get a reference to the mutation.
const ref = createCustomerRef(createCustomerVars);
// Variables can be defined inline as well.
const ref = createCustomerRef({ name: ..., email: ..., phone: ..., address: ..., notes: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createCustomerRef(dataConnect, createCustomerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.customer_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.customer_insert);
});
```

## UpdateCustomer
You can execute the `UpdateCustomer` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
updateCustomer(vars: UpdateCustomerVariables): MutationPromise<UpdateCustomerData, UpdateCustomerVariables>;

interface UpdateCustomerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCustomerVariables): MutationRef<UpdateCustomerData, UpdateCustomerVariables>;
}
export const updateCustomerRef: UpdateCustomerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateCustomer(dc: DataConnect, vars: UpdateCustomerVariables): MutationPromise<UpdateCustomerData, UpdateCustomerVariables>;

interface UpdateCustomerRef {
  ...
  (dc: DataConnect, vars: UpdateCustomerVariables): MutationRef<UpdateCustomerData, UpdateCustomerVariables>;
}
export const updateCustomerRef: UpdateCustomerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateCustomerRef:
```typescript
const name = updateCustomerRef.operationName;
console.log(name);
```

### Variables
The `UpdateCustomer` mutation requires an argument of type `UpdateCustomerVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateCustomerVariables {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: string;
}
```
### Return Type
Recall that executing the `UpdateCustomer` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateCustomerData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateCustomerData {
  customer_update?: Customer_Key | null;
}
```
### Using `UpdateCustomer`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateCustomer, UpdateCustomerVariables } from '@ho-network/dataconnect';

// The `UpdateCustomer` mutation requires an argument of type `UpdateCustomerVariables`:
const updateCustomerVars: UpdateCustomerVariables = {
  id: ..., 
  name: ..., 
  email: ..., // optional
  phone: ..., // optional
  address: ..., // optional
  notes: ..., // optional
  status: ..., 
};

// Call the `updateCustomer()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateCustomer(updateCustomerVars);
// Variables can be defined inline as well.
const { data } = await updateCustomer({ id: ..., name: ..., email: ..., phone: ..., address: ..., notes: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateCustomer(dataConnect, updateCustomerVars);

console.log(data.customer_update);

// Or, you can use the `Promise` API.
updateCustomer(updateCustomerVars).then((response) => {
  const data = response.data;
  console.log(data.customer_update);
});
```

### Using `UpdateCustomer`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateCustomerRef, UpdateCustomerVariables } from '@ho-network/dataconnect';

// The `UpdateCustomer` mutation requires an argument of type `UpdateCustomerVariables`:
const updateCustomerVars: UpdateCustomerVariables = {
  id: ..., 
  name: ..., 
  email: ..., // optional
  phone: ..., // optional
  address: ..., // optional
  notes: ..., // optional
  status: ..., 
};

// Call the `updateCustomerRef()` function to get a reference to the mutation.
const ref = updateCustomerRef(updateCustomerVars);
// Variables can be defined inline as well.
const ref = updateCustomerRef({ id: ..., name: ..., email: ..., phone: ..., address: ..., notes: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateCustomerRef(dataConnect, updateCustomerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.customer_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.customer_update);
});
```

