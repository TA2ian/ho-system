# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createUser, updateUserRole, createCustomer, updateCustomer, listUsers, getUserByUid, listCustomers } from '@ho-network/dataconnect';


// Operation CreateUser:  For variables, look at type CreateUserVars in ../index.d.ts
const { data } = await CreateUser(dataConnect, createUserVars);

// Operation UpdateUserRole:  For variables, look at type UpdateUserRoleVars in ../index.d.ts
const { data } = await UpdateUserRole(dataConnect, updateUserRoleVars);

// Operation CreateCustomer:  For variables, look at type CreateCustomerVars in ../index.d.ts
const { data } = await CreateCustomer(dataConnect, createCustomerVars);

// Operation UpdateCustomer:  For variables, look at type UpdateCustomerVars in ../index.d.ts
const { data } = await UpdateCustomer(dataConnect, updateCustomerVars);

// Operation ListUsers: 
const { data } = await ListUsers(dataConnect);

// Operation GetUserByUid:  For variables, look at type GetUserByUidVars in ../index.d.ts
const { data } = await GetUserByUid(dataConnect, getUserByUidVars);

// Operation ListCustomers: 
const { data } = await ListCustomers(dataConnect);


```