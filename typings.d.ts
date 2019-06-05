/// <reference types="node" />
import * as https from "https";
import * as stream from "stream";

declare class ClickHouse {
    constructor(options: ClickHouse.Options);
    query(chQuery: string, options: ClickHouse.QueryOptions, cb?: ClickHouse.QueryCallback): ClickHouse.RecordStream;
    query(chQuery: string, cb?: ClickHouse.QueryCallback): ClickHouse.RecordStream;
    querying(chQuery: string, options?: ClickHouse.QueryOptions): Promise<ClickHouse.QueryResult>;
    ping(cb?: ClickHouse.QueryCallback): ClickHouse.RecordStream;
    pinging(): Promise<ClickHouse.QueryResult>;
}

declare namespace ClickHouse {
    type SpecificConstructorOptions = {
        user?: string;
        password?: string;
        useQueryString?: boolean;
    } & QueryOptions;

    type ConstructorOptions = https.RequestOptions & SpecificConstructorOptions;

    export type Options = ConstructorOptions | string;

    export type QueryOptions = {
        dataObjects?: boolean;
        format?: string;
        syncParser?: boolean;
        omitFormat?: boolean;
        readonly?: boolean;

        // Any object suitable for querystring.stringify()
        // @see https://nodejs.org/docs/latest-v8.x/api/querystring.html#querystring_querystring_stringify_obj_sep_eq_options
        queryOptions?: {
            [key: string]: string | Array<string> | number | Array<number> | boolean | Array<boolean>;
        };
    };

    export type QueryCallback = (error?: Error) => void;

    export class RecordStream extends stream.Duplex {}

    export type Value = any;

    export type QueryResult = Array<Array<Value>>;
}

export = ClickHouse;
