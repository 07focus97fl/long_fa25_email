create table public.long_fa25_survey_responses (
  id serial not null,
  response_id text not null,
  day date null,
  email text null,
  blacklisted boolean null default false,
  tier1_person text null,
  tier2_person text null,
  tier3_person text null,
  gender text null,
  start_date text null,
  end_date text null,
  recorded_date text null,
  constraint long_fa25_survey_responses_pkey primary key (id),
  constraint long_fa25_survey_responses_response_id_key unique (response_id)
) TABLESPACE pg_default;