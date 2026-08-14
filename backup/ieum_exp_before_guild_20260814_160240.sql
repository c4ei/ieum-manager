--
-- PostgreSQL database dump
--

\restrict ofXOjZOJcneW7Fbqnic5x4LCa6OtH3dbSvmKuU6tSleCl0FTx7903fOa8ohKNUA

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: address_balances; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.address_balances (
    address text NOT NULL,
    balance numeric(78,0) NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    tx_count bigint DEFAULT 0 NOT NULL,
    first_seen_height bigint,
    last_seen_height bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.address_balances OWNER TO ieum;

--
-- Name: blocks; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.blocks (
    height bigint NOT NULL,
    hash text NOT NULL,
    parent_hash text NOT NULL,
    producer text,
    "timestamp" bigint NOT NULL,
    tx_count integer DEFAULT 0 NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    raw jsonb NOT NULL,
    indexed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blocks OWNER TO ieum;

--
-- Name: community_reports; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.community_reports (
    id bigint NOT NULL,
    reporter_user text NOT NULL,
    reporter_wallet text,
    target_type text NOT NULL,
    target_id text NOT NULL,
    reason text NOT NULL,
    evidence text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    reward_status text DEFAULT 'none'::text NOT NULL,
    reviewer_note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT community_reports_reward_status_check CHECK ((reward_status = ANY (ARRAY['none'::text, 'candidate'::text, 'approved'::text, 'paid'::text]))),
    CONSTRAINT community_reports_status_check CHECK ((status = ANY (ARRAY['received'::text, 'reviewing'::text, 'accepted'::text, 'rejected'::text]))),
    CONSTRAINT community_reports_target_type_check CHECK ((target_type = ANY (ARRAY['guild'::text, 'member'::text, 'event'::text])))
);


ALTER TABLE public.community_reports OWNER TO ieum;

--
-- Name: community_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: ieum
--

CREATE SEQUENCE public.community_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_reports_id_seq OWNER TO ieum;

--
-- Name: community_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ieum
--

ALTER SEQUENCE public.community_reports_id_seq OWNED BY public.community_reports.id;


--
-- Name: discovered_nodes; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.discovered_nodes (
    node_id text NOT NULL,
    name text NOT NULL,
    rpc_url text,
    p2p_address text,
    version text,
    height bigint,
    peer_count integer,
    online boolean DEFAULT false NOT NULL,
    source_node_id text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.discovered_nodes OWNER TO ieum;

--
-- Name: explorer_state; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.explorer_state (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.explorer_state OWNER TO ieum;

--
-- Name: guild_events; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.guild_events (
    id bigint NOT NULL,
    guild_id bigint NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.guild_events OWNER TO ieum;

--
-- Name: guild_events_id_seq; Type: SEQUENCE; Schema: public; Owner: ieum
--

CREATE SEQUENCE public.guild_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guild_events_id_seq OWNER TO ieum;

--
-- Name: guild_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ieum
--

ALTER SEQUENCE public.guild_events_id_seq OWNED BY public.guild_events.id;


--
-- Name: guild_members; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.guild_members (
    guild_id bigint NOT NULL,
    wallet text NOT NULL,
    aah_user text NOT NULL,
    rank integer DEFAULT 1 NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT guild_members_rank_check CHECK (((rank >= 1) AND (rank <= 5)))
);


ALTER TABLE public.guild_members OWNER TO ieum;

--
-- Name: guild_payment_receipts; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.guild_payment_receipts (
    tx_hash text NOT NULL,
    guild_id bigint,
    sender text NOT NULL,
    recipient text NOT NULL,
    amount numeric(78,0) NOT NULL,
    block_height bigint NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.guild_payment_receipts OWNER TO ieum;

--
-- Name: guilds; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.guilds (
    id bigint NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    region text DEFAULT ''::text NOT NULL,
    owner_wallet text NOT NULL,
    owner_aah_user text NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT guilds_level_check CHECK (((level >= 1) AND (level <= 5)))
);


ALTER TABLE public.guilds OWNER TO ieum;

--
-- Name: guilds_id_seq; Type: SEQUENCE; Schema: public; Owner: ieum
--

CREATE SEQUENCE public.guilds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guilds_id_seq OWNER TO ieum;

--
-- Name: guilds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ieum
--

ALTER SEQUENCE public.guilds_id_seq OWNED BY public.guilds.id;


--
-- Name: token_transfers; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.token_transfers (
    id bigint NOT NULL,
    token_address text NOT NULL,
    tx_hash text NOT NULL,
    block_height bigint NOT NULL,
    sender text,
    recipient text,
    token_id numeric(78,0),
    amount numeric(78,0),
    metadata_uri text
);


ALTER TABLE public.token_transfers OWNER TO ieum;

--
-- Name: token_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: ieum
--

CREATE SEQUENCE public.token_transfers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.token_transfers_id_seq OWNER TO ieum;

--
-- Name: token_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ieum
--

ALTER SEQUENCE public.token_transfers_id_seq OWNED BY public.token_transfers.id;


--
-- Name: tokens; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.tokens (
    address text NOT NULL,
    standard text NOT NULL,
    name text,
    symbol text,
    decimals integer,
    total_supply numeric(78,0),
    metadata_uri text,
    verified boolean DEFAULT false NOT NULL,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tokens_standard_check CHECK ((standard = ANY (ARRAY['IEUM-20'::text, 'IEUM-721'::text, 'IEUM-1155'::text])))
);


ALTER TABLE public.tokens OWNER TO ieum;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: ieum
--

CREATE TABLE public.transactions (
    hash text NOT NULL,
    block_height bigint NOT NULL,
    tx_index integer NOT NULL,
    sender text NOT NULL,
    recipient text NOT NULL,
    value numeric(78,0) NOT NULL,
    fee numeric(78,0) DEFAULT 0 NOT NULL,
    nonce bigint NOT NULL,
    raw jsonb NOT NULL
);


ALTER TABLE public.transactions OWNER TO ieum;

--
-- Name: community_reports id; Type: DEFAULT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.community_reports ALTER COLUMN id SET DEFAULT nextval('public.community_reports_id_seq'::regclass);


--
-- Name: guild_events id; Type: DEFAULT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guild_events ALTER COLUMN id SET DEFAULT nextval('public.guild_events_id_seq'::regclass);


--
-- Name: guilds id; Type: DEFAULT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guilds ALTER COLUMN id SET DEFAULT nextval('public.guilds_id_seq'::regclass);


--
-- Name: token_transfers id; Type: DEFAULT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.token_transfers ALTER COLUMN id SET DEFAULT nextval('public.token_transfers_id_seq'::regclass);


--
-- Data for Name: address_balances; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.address_balances (address, balance, locked, tx_count, first_seen_height, last_seen_height, updated_at) FROM stdin;
0x13f3e36f5a1c24215bd910d01c567e6dd62d12b7	10000000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.11602+00
0x28c1da651c61d88902883adccc7df0ed2ed8931d	10000000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.117+00
0x3252b7b65e50b54508974db8d634134b0bd6be90	1000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.118396+00
0x356456ff1216b57a6f8891b195b42d296789b67d	9959994520547945209678	f	0	\N	\N	2026-08-14 07:02:40.119347+00
0x475e2f4e40dbd34370e4fce61ddff5ff1f2ea817	99999899999999979000	f	1	\N	2	2026-08-14 07:02:40.119979+00
0x7ea8c617ad2635fa7bcfbb66056c3280df0987f4	10000000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.120643+00
0xada04f6ea65dc31079825e47296d0737a4594696	10000000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.121475+00
0xb0e5863d0ddf7e105e409fee0ecc0123a362e14b	1000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.122476+00
0xbcdf32f90e36d8d0883ac5ac8a46a7c575eaf507	10000000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.123421+00
0xc23104a7dbd6c6616251728018ba4106d57a154b	10000000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.124451+00
0xc30de1af9ff76455ecb6b827384381501ebfdc55	10000000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.125543+00
0xd5ac7674ac15e3df0b7d737cf8cb8f2ea713f329	1000100000000000000	f	1	\N	2	2026-08-14 07:02:40.126606+00
0xf0dcb0ea878057ff5c78c4737023f900ece09e7b	1000000000000000000	f	0	\N	\N	2026-08-14 07:02:40.127482+00
9b2cea5fea85568027fd3013d801b00e7a8391fa011692d1980bc15772cb5d0b	10001369863013698630	f	0	\N	\N	2026-08-14 07:02:40.128173+00
cf91fb3db2bac80635129cb54a9f6eaecefca2e100853000033eceb424de3574	10001369863013715432	f	0	\N	\N	2026-08-14 07:02:40.128762+00
d475e3a8a10a569c05c3d6406bb37adc681f5372e5855ffd76d24d5df91cad5d	10001369863013698630	f	0	\N	\N	2026-08-14 07:02:40.129474+00
e15cf544de4227476a8b1ec570094ad43242cdf24939007a25dc2abd94abebe4	10001369863013698630	f	0	\N	\N	2026-08-14 07:02:40.130051+00
\.


--
-- Data for Name: blocks; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.blocks (height, hash, parent_hash, producer, "timestamp", tx_count, size_bytes, raw, indexed_at) FROM stdin;
0	0x4a0b39a00a9625d44c040ebb97cf1351a5cd2dcd314d56455cd85fd681fd59d4	0x0000000000000000000000000000000000000000000000000000000000000000	genesis	1785942000	0	231	{"hash": "0x4a0b39a00a9625d44c040ebb97cf1351a5cd2dcd314d56455cd85fd681fd59d4", "size": "0xe7", "miner": "genesis", "number": "0x0", "timestamp": "0x6a734ff0", "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000", "transactions": [], "ieumSystemEvents": [], "transactionsRoot": "0x4a0b39a00a9625d44c040ebb97cf1351a5cd2dcd314d56455cd85fd681fd59d4"}	2026-08-12 08:43:30.647612+00
1	0x3149c03a3742f7281163221a7578f6aabd25832f2be9f6eaac2b03af5d285964	0x4a0b39a00a9625d44c040ebb97cf1351a5cd2dcd314d56455cd85fd681fd59d4	9b2cea5fea85568027fd3013d801b00e7a8391fa011692d1980bc15772cb5d0b	1786524213	0	1655	{"hash": "0x3149c03a3742f7281163221a7578f6aabd25832f2be9f6eaac2b03af5d285964", "size": "0x677", "miner": "9b2cea5fea85568027fd3013d801b00e7a8391fa011692d1980bc15772cb5d0b", "number": "0x1", "timestamp": "0x6a7c3235", "parentHash": "0x4a0b39a00a9625d44c040ebb97cf1351a5cd2dcd314d56455cd85fd681fd59d4", "transactions": [], "ieumSystemEvents": [{"id": "ieum-bootstrap-validator-reward-v1", "action": {"type": "bootstrap_validator_reward", "amount": "10000000000000000000", "registrations": [{"peer_id": "12D3KooWGABnBEucGacnREpBieFwspL5q7Aa6RRuj1MtxEYwrPo2", "validator_id": "9b2cea5fea85568027fd3013d801b00e7a8391fa011692d1980bc15772cb5d0b", "signature_hex": "60a4af4bc4d0275cd7de4a026d6daeba254c226398d0b17493aed042fae2e094b244a63f468759ec7a122b31b37390eb4a4af1c97179f70ebd33eee75551a607"}, {"peer_id": "12D3KooWE18Cv12b4R5bjrZg1RDGiPXbMDQZqz1t9rfrNaLpwDRB", "validator_id": "cf91fb3db2bac80635129cb54a9f6eaecefca2e100853000033eceb424de3574", "signature_hex": "fd15440f7cc63e7944cd7a2c72aafa78d93836f5c401d605091139b5005abebdd4f398d33e6546629afe9c6a48988121d53de3836eac995a5aa2ca7e8adcc60e"}, {"peer_id": "12D3KooWLqqVdBzWGGc3bjaarVpsu2WA6DTYuzKGoYCznbgrugnX", "validator_id": "d475e3a8a10a569c05c3d6406bb37adc681f5372e5855ffd76d24d5df91cad5d", "signature_hex": "1cce3ad6ffd89b820403c6337629fcde08e08c7a46466f9d91bcfcc9233f5bf4848fcd7bdb22ae6350c63634188c98c28bbb416f2181c64c3e69b3ff2a086000"}, {"peer_id": "12D3KooWCByiTkyDHySsS3GRFVHue1ewPGSdgSWEvzMrtwggM3Wg", "validator_id": "e15cf544de4227476a8b1ec570094ad43242cdf24939007a25dc2abd94abebe4", "signature_hex": "ead6639a8501e7b0c2c3ffb2c8b35971551120a23e042b2fc01a06be6ad4b548e7995cffc93aab655f1c6e71a3bbe8af4ac6569f4ab967bed06c64a13a317e08"}]}, "execute_at": 1786524213}], "transactionsRoot": "0x3149c03a3742f7281163221a7578f6aabd25832f2be9f6eaac2b03af5d285964"}	2026-08-12 08:43:33.703778+00
2	0x18c9ba9ee8d139f341ab40cd444db868a617531c57fecbad9d79523c9b608895	0x3149c03a3742f7281163221a7578f6aabd25832f2be9f6eaac2b03af5d285964	cf91fb3db2bac80635129cb54a9f6eaecefca2e100853000033eceb424de3574	1786599240	1	674	{"hash": "0x18c9ba9ee8d139f341ab40cd444db868a617531c57fecbad9d79523c9b608895", "size": "0x2a2", "miner": "cf91fb3db2bac80635129cb54a9f6eaecefca2e100853000033eceb424de3574", "number": "0x2", "timestamp": "0x6a7d5748", "parentHash": "0x3149c03a3742f7281163221a7578f6aabd25832f2be9f6eaac2b03af5d285964", "transactions": [{"to": "0xd5ac7674ac15e3df0b7d737cf8cb8f2ea713f329", "from": "0x475e2f4e40dbd34370e4fce61ddff5ff1f2ea817", "hash": "0x0b9918adb4e8fbf73ad34b3f089bb6ebd7ebd2968a6178ac9d15c55c60510cd7", "input": "0x", "nonce": "0x0", "value": "0x5af3107a4000", "gasPrice": "0x5208", "blockHash": "0x18c9ba9ee8d139f341ab40cd444db868a617531c57fecbad9d79523c9b608895", "blockNumber": "0x2", "transactionIndex": "0x0"}], "ieumSystemEvents": [], "transactionsRoot": "0x18c9ba9ee8d139f341ab40cd444db868a617531c57fecbad9d79523c9b608895"}	2026-08-13 05:34:02.75998+00
3	0x4c560554846393719b6d8d0c59f5db1433eb3ffd9bad111de9aac4a21bd5ad5b	0x18c9ba9ee8d139f341ab40cd444db868a617531c57fecbad9d79523c9b608895	d475e3a8a10a569c05c3d6406bb37adc681f5372e5855ffd76d24d5df91cad5d	1786675253	0	981	{"hash": "0x4c560554846393719b6d8d0c59f5db1433eb3ffd9bad111de9aac4a21bd5ad5b", "size": "0x3d5", "miner": "d475e3a8a10a569c05c3d6406bb37adc681f5372e5855ffd76d24d5df91cad5d", "number": "0x3", "timestamp": "0x6a7e8035", "parentHash": "0x18c9ba9ee8d139f341ab40cd444db868a617531c57fecbad9d79523c9b608895", "transactions": [], "ieumSystemEvents": [{"id": "ieum-validator-interest-v1-20679", "action": {"type": "validator_daily_interest", "payments": [{"amount": "1369863013698630", "address": "9b2cea5fea85568027fd3013d801b00e7a8391fa011692d1980bc15772cb5d0b"}, {"amount": "1369863013698632", "address": "cf91fb3db2bac80635129cb54a9f6eaecefca2e100853000033eceb424de3574"}, {"amount": "1369863013698630", "address": "d475e3a8a10a569c05c3d6406bb37adc681f5372e5855ffd76d24d5df91cad5d"}, {"amount": "1369863013698630", "address": "e15cf544de4227476a8b1ec570094ad43242cdf24939007a25dc2abd94abebe4"}], "policy_hash": "8adb61db92db7065f86569d36dc2910a40b5870de0b605d7ae3b21adb8fe838b", "annual_rate_bps": 500, "snapshot_height": 2}, "execute_at": 1786633200}], "transactionsRoot": "0x4c560554846393719b6d8d0c59f5db1433eb3ffd9bad111de9aac4a21bd5ad5b"}	2026-08-14 02:40:54.28473+00
\.


--
-- Data for Name: community_reports; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.community_reports (id, reporter_user, reporter_wallet, target_type, target_id, reason, evidence, status, reward_status, reviewer_note, created_at, reviewed_at) FROM stdin;
\.


--
-- Data for Name: discovered_nodes; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.discovered_nodes (node_id, name, rpc_url, p2p_address, version, height, peer_count, online, source_node_id, last_seen_at, raw) FROM stdin;
node-2	Main Node 2	http://192.168.1.148:8990	\N	0.22.9	3	4	t	\N	2026-08-14 07:02:40.086397+00	{"peers": 4, "height": 3, "chainId": 21004, "syncing": false, "version": "0.22.9", "blockHash": "0x4c560554846393719b6d8d0c59f5db1433eb3ffd9bad111de9aac4a21bd5ad5b", "stateRoot": "0x60ca4b418bd00efa7249df80c804eee8bf2e06f357d11b5c1b6a19eb7f9642d0", "syncCurrent": 3, "syncHighest": 3, "mempoolBytes": 0, "uptimeSeconds": 4888, "mempoolTransactions": 0}
node-1	Main Node 1	http://192.168.1.148:8989	\N	0.22.9	3	4	t	\N	2026-08-14 07:02:40.0766+00	{"peers": 4, "height": 3, "chainId": 21004, "syncing": false, "version": "0.22.9", "blockHash": "0x4c560554846393719b6d8d0c59f5db1433eb3ffd9bad111de9aac4a21bd5ad5b", "stateRoot": "0x60ca4b418bd00efa7249df80c804eee8bf2e06f357d11b5c1b6a19eb7f9642d0", "syncCurrent": 3, "syncHighest": 3, "mempoolBytes": 0, "uptimeSeconds": 5015, "mempoolTransactions": 0}
12D3KooWCByiTkyDHySsS3GRFVHue1ewPGSdgSWEvzMrtwggM3Wg	12D3KooWCByiTkyDHySsS3GRFVHue1ewPGSdgSWEvzMrtwggM3Wg	\N	/ip4/192.168.1.148/udp/7004/quic-v1	\N	3	1	t	node-3	2026-08-14 07:02:40.098956+00	{"peerId": "12D3KooWCByiTkyDHySsS3GRFVHue1ewPGSdgSWEvzMrtwggM3Wg", "address": "/ip4/192.168.1.148/udp/7004/quic-v1", "remoteIp": "192.168.1.148", "direction": "수신", "connectedAt": 1786686118, "connections": 1, "connectedSeconds": 4842}
12D3KooWE18Cv12b4R5bjrZg1RDGiPXbMDQZqz1t9rfrNaLpwDRB	12D3KooWE18Cv12b4R5bjrZg1RDGiPXbMDQZqz1t9rfrNaLpwDRB	\N	/ip4/192.168.1.148/udp/7003/quic-v1/p2p/12D3KooWE18Cv12b4R5bjrZg1RDGiPXbMDQZqz1t9rfrNaLpwDRB	\N	3	1	t	node-4	2026-08-14 07:02:40.109925+00	{"peerId": "12D3KooWE18Cv12b4R5bjrZg1RDGiPXbMDQZqz1t9rfrNaLpwDRB", "address": "/ip4/192.168.1.148/udp/7003/quic-v1/p2p/12D3KooWE18Cv12b4R5bjrZg1RDGiPXbMDQZqz1t9rfrNaLpwDRB", "remoteIp": "192.168.1.148", "direction": "발신", "connectedAt": 1786686118, "connections": 1, "connectedSeconds": 4842}
12D3KooWLqqVdBzWGGc3bjaarVpsu2WA6DTYuzKGoYCznbgrugnX	12D3KooWLqqVdBzWGGc3bjaarVpsu2WA6DTYuzKGoYCznbgrugnX	\N	/ip4/192.168.1.148/udp/7002/quic-v1/p2p/12D3KooWLqqVdBzWGGc3bjaarVpsu2WA6DTYuzKGoYCznbgrugnX	\N	3	1	t	node-4	2026-08-14 07:02:40.112588+00	{"peerId": "12D3KooWLqqVdBzWGGc3bjaarVpsu2WA6DTYuzKGoYCznbgrugnX", "address": "/ip4/192.168.1.148/udp/7002/quic-v1/p2p/12D3KooWLqqVdBzWGGc3bjaarVpsu2WA6DTYuzKGoYCznbgrugnX", "remoteIp": "192.168.1.148", "direction": "발신", "connectedAt": 1786686118, "connections": 1, "connectedSeconds": 4842}
node-3	Main Node 3	http://192.168.1.148:8991	\N	0.22.9	3	4	t	\N	2026-08-14 07:02:40.095579+00	{"peers": 4, "height": 3, "chainId": 21004, "syncing": false, "version": "0.22.9", "blockHash": "0x4c560554846393719b6d8d0c59f5db1433eb3ffd9bad111de9aac4a21bd5ad5b", "stateRoot": "0x60ca4b418bd00efa7249df80c804eee8bf2e06f357d11b5c1b6a19eb7f9642d0", "syncCurrent": 3, "syncHighest": 3, "mempoolBytes": 0, "uptimeSeconds": 4861, "mempoolTransactions": 0}
node-4	Main Node 4	http://192.168.1.148:8992	\N	0.22.9	3	4	t	\N	2026-08-14 07:02:40.106106+00	{"peers": 4, "height": 3, "chainId": 21004, "syncing": false, "version": "0.22.9", "blockHash": "0x4c560554846393719b6d8d0c59f5db1433eb3ffd9bad111de9aac4a21bd5ad5b", "stateRoot": "0x60ca4b418bd00efa7249df80c804eee8bf2e06f357d11b5c1b6a19eb7f9642d0", "syncCurrent": 3, "syncHighest": 3, "mempoolBytes": 0, "uptimeSeconds": 4841, "mempoolTransactions": 0}
12D3KooWGABnBEucGacnREpBieFwspL5q7Aa6RRuj1MtxEYwrPo2	12D3KooWGABnBEucGacnREpBieFwspL5q7Aa6RRuj1MtxEYwrPo2	\N	/ip4/192.168.1.148/udp/7001/quic-v1/p2p/12D3KooWGABnBEucGacnREpBieFwspL5q7Aa6RRuj1MtxEYwrPo2	\N	3	1	t	node-4	2026-08-14 07:02:40.110975+00	{"peerId": "12D3KooWGABnBEucGacnREpBieFwspL5q7Aa6RRuj1MtxEYwrPo2", "address": "/ip4/192.168.1.148/udp/7001/quic-v1/p2p/12D3KooWGABnBEucGacnREpBieFwspL5q7Aa6RRuj1MtxEYwrPo2", "remoteIp": "192.168.1.148", "direction": "발신", "connectedAt": 1786686118, "connections": 1, "connectedSeconds": 4842}
12D3KooWJSkdAMLszdeSGGFvWxFiJPgUfh18DHRH67sBrh4kweHv	12D3KooWJSkdAMLszdeSGGFvWxFiJPgUfh18DHRH67sBrh4kweHv	\N	/ip4/1.232.161.2/udp/50848/quic-v1	\N	3	1	t	node-4	2026-08-14 07:02:40.111712+00	{"peerId": "12D3KooWJSkdAMLszdeSGGFvWxFiJPgUfh18DHRH67sBrh4kweHv", "address": "/ip4/1.232.161.2/udp/50848/quic-v1", "remoteIp": "1.232.161.2", "direction": "수신", "connectedAt": 1786690459, "connections": 1, "connectedSeconds": 501}
\.


--
-- Data for Name: explorer_state; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.explorer_state (key, value, updated_at) FROM stdin;
last_height	3	2026-08-14 02:40:54.28473+00
genesis_hash	0x4a0b39a00a9625d44c040ebb97cf1351a5cd2dcd314d56455cd85fd681fd59d4	2026-08-14 07:02:40.073146+00
\.


--
-- Data for Name: guild_events; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.guild_events (id, guild_id, title, description, starts_at, ends_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: guild_members; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.guild_members (guild_id, wallet, aah_user, rank, joined_at) FROM stdin;
\.


--
-- Data for Name: guild_payment_receipts; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.guild_payment_receipts (tx_hash, guild_id, sender, recipient, amount, block_height, verified_at) FROM stdin;
\.


--
-- Data for Name: guilds; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.guilds (id, name, description, region, owner_wallet, owner_aah_user, level, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: token_transfers; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.token_transfers (id, token_address, tx_hash, block_height, sender, recipient, token_id, amount, metadata_uri) FROM stdin;
\.


--
-- Data for Name: tokens; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.tokens (address, standard, name, symbol, decimals, total_supply, metadata_uri, verified, raw, updated_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: ieum
--

COPY public.transactions (hash, block_height, tx_index, sender, recipient, value, fee, nonce, raw) FROM stdin;
0x0b9918adb4e8fbf73ad34b3f089bb6ebd7ebd2968a6178ac9d15c55c60510cd7	2	0	0x475e2f4e40dbd34370e4fce61ddff5ff1f2ea817	0xd5ac7674ac15e3df0b7d737cf8cb8f2ea713f329	100000000000000	21000	0	{"to": "0xd5ac7674ac15e3df0b7d737cf8cb8f2ea713f329", "from": "0x475e2f4e40dbd34370e4fce61ddff5ff1f2ea817", "hash": "0x0b9918adb4e8fbf73ad34b3f089bb6ebd7ebd2968a6178ac9d15c55c60510cd7", "input": "0x", "nonce": "0x0", "value": "0x5af3107a4000", "gasPrice": "0x5208", "blockHash": "0x18c9ba9ee8d139f341ab40cd444db868a617531c57fecbad9d79523c9b608895", "blockNumber": "0x2", "transactionIndex": "0x0"}
\.


--
-- Name: community_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ieum
--

SELECT pg_catalog.setval('public.community_reports_id_seq', 1, false);


--
-- Name: guild_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ieum
--

SELECT pg_catalog.setval('public.guild_events_id_seq', 1, false);


--
-- Name: guilds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ieum
--

SELECT pg_catalog.setval('public.guilds_id_seq', 1, false);


--
-- Name: token_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ieum
--

SELECT pg_catalog.setval('public.token_transfers_id_seq', 1, false);


--
-- Name: address_balances address_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.address_balances
    ADD CONSTRAINT address_balances_pkey PRIMARY KEY (address);


--
-- Name: blocks blocks_hash_key; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_hash_key UNIQUE (hash);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (height);


--
-- Name: community_reports community_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.community_reports
    ADD CONSTRAINT community_reports_pkey PRIMARY KEY (id);


--
-- Name: discovered_nodes discovered_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.discovered_nodes
    ADD CONSTRAINT discovered_nodes_pkey PRIMARY KEY (node_id);


--
-- Name: explorer_state explorer_state_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.explorer_state
    ADD CONSTRAINT explorer_state_pkey PRIMARY KEY (key);


--
-- Name: guild_events guild_events_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guild_events
    ADD CONSTRAINT guild_events_pkey PRIMARY KEY (id);


--
-- Name: guild_members guild_members_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_pkey PRIMARY KEY (guild_id, wallet);


--
-- Name: guild_payment_receipts guild_payment_receipts_guild_id_key; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guild_payment_receipts
    ADD CONSTRAINT guild_payment_receipts_guild_id_key UNIQUE (guild_id);


--
-- Name: guild_payment_receipts guild_payment_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guild_payment_receipts
    ADD CONSTRAINT guild_payment_receipts_pkey PRIMARY KEY (tx_hash);


--
-- Name: guilds guilds_name_key; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_name_key UNIQUE (name);


--
-- Name: guilds guilds_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_pkey PRIMARY KEY (id);


--
-- Name: token_transfers token_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.token_transfers
    ADD CONSTRAINT token_transfers_pkey PRIMARY KEY (id);


--
-- Name: tokens tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.tokens
    ADD CONSTRAINT tokens_pkey PRIMARY KEY (address);


--
-- Name: transactions transactions_block_height_tx_index_key; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_block_height_tx_index_key UNIQUE (block_height, tx_index);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (hash);


--
-- Name: address_balances_top_idx; Type: INDEX; Schema: public; Owner: ieum
--

CREATE INDEX address_balances_top_idx ON public.address_balances USING btree (balance DESC);


--
-- Name: token_transfers_owner_idx; Type: INDEX; Schema: public; Owner: ieum
--

CREATE INDEX token_transfers_owner_idx ON public.token_transfers USING btree (lower(recipient), block_height DESC);


--
-- Name: transactions_height_idx; Type: INDEX; Schema: public; Owner: ieum
--

CREATE INDEX transactions_height_idx ON public.transactions USING btree (block_height DESC, tx_index);


--
-- Name: transactions_recipient_idx; Type: INDEX; Schema: public; Owner: ieum
--

CREATE INDEX transactions_recipient_idx ON public.transactions USING btree (lower(recipient), block_height DESC);


--
-- Name: transactions_sender_idx; Type: INDEX; Schema: public; Owner: ieum
--

CREATE INDEX transactions_sender_idx ON public.transactions USING btree (lower(sender), block_height DESC);


--
-- Name: guild_events guild_events_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guild_events
    ADD CONSTRAINT guild_events_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: guild_members guild_members_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: guild_payment_receipts guild_payment_receipts_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.guild_payment_receipts
    ADD CONSTRAINT guild_payment_receipts_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE RESTRICT;


--
-- Name: token_transfers token_transfers_token_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.token_transfers
    ADD CONSTRAINT token_transfers_token_address_fkey FOREIGN KEY (token_address) REFERENCES public.tokens(address);


--
-- Name: transactions transactions_block_height_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ieum
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_block_height_fkey FOREIGN KEY (block_height) REFERENCES public.blocks(height) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ofXOjZOJcneW7Fbqnic5x4LCa6OtH3dbSvmKuU6tSleCl0FTx7903fOa8ohKNUA

