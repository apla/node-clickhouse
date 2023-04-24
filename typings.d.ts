/// <reference types="node" />
import * as https from "https";
import * as stream from "stream";

declare class ClickHouse<ConstructorOptions extends ClickHouse.Options = ClickHouse.Options> {
    constructor(options: ConstructorOptions);
    query(chQuery: string, options: ClickHouse.QueryOptions, cb?: ClickHouse.QueryCallback): ClickHouse.RecordStream;
    query(chQuery: string, cb?: ClickHouse.QueryCallback): ClickHouse.RecordStream;
    querying<
        QueryOptions extends ClickHouse.QueryOptions,
        RecordType extends ClickHouse.DefaultRecordType<ConstructorOptions, QueryOptions, unknown> = ClickHouse.DefaultRecordType<ConstructorOptions, QueryOptions, any>
    >(chQuery: string, options?: QueryOptions): Promise<ClickHouse.QueryResult<RecordType>>;
    ping(cb?: ClickHouse.QueryCallback): ClickHouse.RecordStream;
    pinging(): Promise<string>;
}

declare namespace ClickHouse {
    type SpecificConstructorOptions = {
        // Host is required, overriding it
        host: string;
        user?: string;
        password?: string;
        useQueryString?: boolean;
    } & QueryOptions;

    type ConstructorOptions = https.RequestOptions & SpecificConstructorOptions;

    export type Options = ConstructorOptions | string;

    export type QueryOptions = {
        dataObjects?: boolean;
        format?: Format;
        syncParser?: boolean;
        omitFormat?: boolean;
        readonly?: boolean;
        queryOptions?: {
            [key: string]: string | number | boolean;
        };
    };

    export type QueryCallback = (error?: Error) => void;

    export class RecordStream extends stream.Duplex {}

    export type Format = "TabSeparated" | "TSV" | "TabSeparatedRaw" | "TSVRaw" | "TabSeparatedWithNames" | "TSVWithNames" | "TabSeparatedWithNamesAndTypes" | "TSVWithNamesAndTypes" | "Template" | "TemplateIgnoreSpaces" | "CSV" | "CSVWithNames" | "CustomSeparated" | "Values" | "Vertical" | "JSON" | "JSONCompact" | "JSONEachRow" | "TSKV" | "Pretty" | "PrettyCompact" | "PrettyCompactMonoBlock" | "PrettyNoEscapes" | "PrettySpace" | "Protobuf" | "Parquet" | "RowBinary" | "RowBinaryWithNamesAndTypes" | "Native" | "Null" | "XML" | "CapnProto";

    type StringResultFormat = Exclude<Format, "JSON" | "JSONCompact">;

    // This is returned when format=JSON, format=JSONCompact or dataObject=true specified
    export type ObjectQueryResult<RecordType> = {
        meta: Array<{
            name: string;
            type: string;
        }>;
        totals?: any;
        extremes?: any;
        data: Array<RecordType>;
        rows: number;
        rows_before_limit_at_least?: number;
        statistics: {
            elapsed: number;
            rows_read: number;
            bytes_read: number;
        };
        transferred: number;
    }

    // DefaultRecordType<ConstructorOptions, QueryOptions, unknown> is used to check any user-defined type
    // DefaultRecordType<ConstructorOptions, QueryOptions, any> is used as a default if user does not supply specific type
    // DefaultRecordType<ConstructorOptions, QueryOptions, any> cannot be used to check user-defined type as it allows pretty much anything, including Array
    type DefaultRecordType<ConstructorOptions, QueryOptions, Value> =
        QueryOptions extends {format: "JSON"} ? Record<string, Value> :
        QueryOptions extends {format: "JSONCompact"} ? Array<Value> :
        QueryOptions extends {format: StringResultFormat} ? null :
        ConstructorOptions extends {format: "JSON"} ? Record<string, Value> :
        ConstructorOptions extends {format: "JSONCompact"} ? Array<Value> :
        ConstructorOptions extends {format: StringResultFormat} ? null :
        QueryOptions extends {dataObjects: true} ? Record<string, Value> :
        ConstructorOptions extends {dataObjects: true} ? Record<string, Value> :
        Array<Value>;

    // string is returned for any non-JSON format
    export type QueryResult<RecordType> =
        RecordType extends null ? string : ObjectQueryResult<RecordType>;
}

export = ClickHouse;
