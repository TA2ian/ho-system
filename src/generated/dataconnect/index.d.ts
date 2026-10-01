import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateCustomerData {
  customer_insert: Customer_Key;
}

export interface CreateCustomerVariables {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: string;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  uid: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
}

export interface Customer_Key {
  id: number;
  __typename?: 'Customer_Key';
}

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

export interface GetUserByUidVariables {
  uid: string;
}

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

export interface UpdateCustomerData {
  customer_update?: Customer_Key | null;
}

export interface UpdateCustomerVariables {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: string;
}

export interface UpdateUserRoleData {
  user_updateMany: number;
}

export interface UpdateUserRoleVariables {
  uid: string;
  role: string;
}

export interface User_Key {
  id: number;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface UpdateUserRoleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserRoleVariables): MutationRef<UpdateUserRoleData, UpdateUserRoleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserRoleVariables): MutationRef<UpdateUserRoleData, UpdateUserRoleVariables>;
  operationName: string;
}
export const updateUserRoleRef: UpdateUserRoleRef;

export function updateUserRole(vars: UpdateUserRoleVariables): MutationPromise<UpdateUserRoleData, UpdateUserRoleVariables>;
export function updateUserRole(dc: DataConnect, vars: UpdateUserRoleVariables): MutationPromise<UpdateUserRoleData, UpdateUserRoleVariables>;

interface CreateCustomerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCustomerVariables): MutationRef<CreateCustomerData, CreateCustomerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateCustomerVariables): MutationRef<CreateCustomerData, CreateCustomerVariables>;
  operationName: string;
}
export const createCustomerRef: CreateCustomerRef;

export function createCustomer(vars: CreateCustomerVariables): MutationPromise<CreateCustomerData, CreateCustomerVariables>;
export function createCustomer(dc: DataConnect, vars: CreateCustomerVariables): MutationPromise<CreateCustomerData, CreateCustomerVariables>;

interface UpdateCustomerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCustomerVariables): MutationRef<UpdateCustomerData, UpdateCustomerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateCustomerVariables): MutationRef<UpdateCustomerData, UpdateCustomerVariables>;
  operationName: string;
}
export const updateCustomerRef: UpdateCustomerRef;

export function updateCustomer(vars: UpdateCustomerVariables): MutationPromise<UpdateCustomerData, UpdateCustomerVariables>;
export function updateCustomer(dc: DataConnect, vars: UpdateCustomerVariables): MutationPromise<UpdateCustomerData, UpdateCustomerVariables>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface GetUserByUidRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByUidVariables): QueryRef<GetUserByUidData, GetUserByUidVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByUidVariables): QueryRef<GetUserByUidData, GetUserByUidVariables>;
  operationName: string;
}
export const getUserByUidRef: GetUserByUidRef;

export function getUserByUid(vars: GetUserByUidVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByUidData, GetUserByUidVariables>;
export function getUserByUid(dc: DataConnect, vars: GetUserByUidVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByUidData, GetUserByUidVariables>;

interface ListCustomersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCustomersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListCustomersData, undefined>;
  operationName: string;
}
export const listCustomersRef: ListCustomersRef;

export function listCustomers(options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, undefined>;
export function listCustomers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, undefined>;

