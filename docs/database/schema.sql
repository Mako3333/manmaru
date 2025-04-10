create table public.caution_foods (
  id uuid not null default extensions.uuid_generate_v4 (),
  food_name text not null,
  category text not null,
  caution_level text not null,
  reason text not null,
  alternative_suggestion text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint caution_foods_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_caution_foods_category on public.caution_foods using btree (category) TABLESPACE pg_default;

create table public.clipped_recipes (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  title text not null,
  image_url text null,
  source_url text not null,
  source_platform text null,
  recipe_type text null,
  ingredients jsonb null,
  nutrition_per_serving jsonb not null,
  caution_foods text[] null,
  caution_level text null,
  is_favorite boolean null default false,
  servings integer null default 1,
  clipped_at timestamp with time zone null default now(),
  last_used_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  use_placeholder boolean null default false,
  is_social_media boolean null default false,
  content_id text null,
  constraint clipped_recipes_pkey primary key (id),
  constraint clipped_recipes_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_clipped_recipes_user_id on public.clipped_recipes using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_clipped_recipes_recipe_type on public.clipped_recipes using btree (recipe_type) TABLESPACE pg_default;

create index IF not exists idx_clipped_recipes_caution_level on public.clipped_recipes using btree (caution_level) TABLESPACE pg_default;

create table public.daily_nutri_advice (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  advice_date date not null default CURRENT_DATE,
  advice_type text not null,
  advice_summary text not null,
  advice_detail text null,
  recommended_foods jsonb null default '[]'::jsonb,
  is_read boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint daily_nutri_advice_pkey primary key (id),
  constraint daily_nutri_advice_user_id_advice_date_advice_type_key unique (user_id, advice_date, advice_type),
  constraint daily_nutri_advice_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_daily_nutri_advice_updated_at BEFORE
update on daily_nutri_advice for EACH row
execute FUNCTION update_updated_at_column ();

create table public.daily_nutrition_logs (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  log_date date null,
  nutrition_data jsonb null,
  ai_comment text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint daily_nutrition_logs_pkey primary key (id),
  constraint daily_nutrition_logs_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_daily_nutrition_logs_user_date on public.daily_nutrition_logs using btree (user_id, log_date) TABLESPACE pg_default;

create table public.food_aliases (
  id uuid not null default extensions.uuid_generate_v4 (),
  food_id uuid null,
  alias text not null,
  constraint food_aliases_pkey primary key (id),
  constraint food_aliases_food_id_fkey foreign KEY (food_id) references food_items (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_food_aliases_alias on public.food_aliases using gin (alias gin_trgm_ops) TABLESPACE pg_default;

create table public.food_categories (
  id character varying(2) not null,
  name text not null,
  description text null,
  created_at timestamp with time zone null default now(),
  constraint food_categories_pkey primary key (id)
) TABLESPACE pg_default;

create table public.food_items (
  id uuid not null default extensions.uuid_generate_v4 (),
  original_id text null,
  name text not null,
  calories numeric not null,
  protein numeric not null,
  iron numeric not null,
  folic_acid numeric not null,
  calcium numeric not null,
  vitamin_d numeric not null,
  standard_quantity text null default '100g'::text,
  cooking_method text null,
  category text null,
  pregnancy_caution boolean null default false,
  created_at timestamp with time zone null default now(),
  category_id character varying(2) null,
  constraint food_items_pkey primary key (id),
  constraint food_items_category_id_fkey foreign KEY (category_id) references food_categories (id)
) TABLESPACE pg_default;

create index IF not exists idx_food_items_name on public.food_items using gin (name gin_trgm_ops) TABLESPACE pg_default;

create index IF not exists idx_food_items_category_id on public.food_items using btree (category_id) TABLESPACE pg_default;

create table public.meal_nutrients (
  id uuid not null default extensions.uuid_generate_v4 (),
  meal_id uuid not null,
  calories numeric null default 0,
  protein numeric null default 0,
  iron numeric null default 0,
  folic_acid numeric null default 0,
  calcium numeric null default 0,
  vitamin_d numeric null default 0,
  confidence_score numeric null,
  created_at timestamp with time zone null default now(),
  constraint meal_nutrients_pkey primary key (id),
  constraint meal_nutrients_meal_id_fkey foreign KEY (meal_id) references meals (id)
) TABLESPACE pg_default;

create index IF not exists idx_meal_nutrients_meal_id on public.meal_nutrients using btree (meal_id) TABLESPACE pg_default;

create table public.meal_recipe_entries (
  id uuid not null default extensions.uuid_generate_v4 (),
  meal_id uuid not null,
  clipped_recipe_id uuid not null,
  portion_size double precision null default 1.0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint meal_recipe_entries_pkey primary key (id),
  constraint meal_recipe_entries_clipped_recipe_id_fkey foreign KEY (clipped_recipe_id) references clipped_recipes (id),
  constraint meal_recipe_entries_meal_id_fkey foreign KEY (meal_id) references meals (id)
) TABLESPACE pg_default;

create index IF not exists idx_meal_recipe_entries_meal_id on public.meal_recipe_entries using btree (meal_id) TABLESPACE pg_default;

create index IF not exists idx_meal_recipe_entries_recipe_id on public.meal_recipe_entries using btree (clipped_recipe_id) TABLESPACE pg_default;

create trigger update_meal_nutrition_after_recipe_entry
after INSERT
or
update on meal_recipe_entries for EACH row
execute FUNCTION update_meal_nutrition_from_recipe ();

create table public.meals (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  meal_type character varying null,
  meal_date date null,
  photo_url text null,
  food_description jsonb null,
  nutrition_data jsonb null,
  servings integer null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint meals_pkey primary key (id),
  constraint meals_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_meals_user_date on public.meals using btree (user_id, meal_date) TABLESPACE pg_default;

create view public.nutrition_goal_prog as
with
  daily_nutrients as (
    select
      m.user_id,
      m.meal_date,
      COALESCE(sum(mn.calories), 0::numeric) as total_calories,
      COALESCE(sum(mn.protein), 0::numeric) as total_protein,
      COALESCE(sum(mn.iron), 0::numeric) as total_iron,
      COALESCE(sum(mn.folic_acid), 0::numeric) as total_folic_acid,
      COALESCE(sum(mn.calcium), 0::numeric) as total_calcium,
      COALESCE(sum(mn.vitamin_d), 0::numeric) as total_vitamin_d
    from
      meals m
      left join meal_nutrients mn on m.id = mn.meal_id
    group by
      m.user_id,
      m.meal_date
  )
select
  dn.user_id,
  calculate_trimester (p.due_date) as trimester,
  dn.meal_date,
  nt.calories as target_calories,
  nt.protein as target_protein,
  nt.iron as target_iron,
  nt.folic_acid as target_folic_acid,
  nt.calcium as target_calcium,
  nt.vitamin_d as target_vitamin_d,
  dn.total_calories as actual_calories,
  dn.total_protein as actual_protein,
  dn.total_iron as actual_iron,
  dn.total_folic_acid as actual_folic_acid,
  dn.total_calcium as actual_calcium,
  dn.total_vitamin_d as actual_vitamin_d,
  case
    when nt.calories > 0::numeric then dn.total_calories / nt.calories * 100::numeric
    else 0::numeric
  end as calories_percent,
  case
    when nt.protein > 0::numeric then dn.total_protein / nt.protein * 100::numeric
    else 0::numeric
  end as protein_percent,
  case
    when nt.iron > 0::numeric then dn.total_iron / nt.iron * 100::numeric
    else 0::numeric
  end as iron_percent,
  case
    when nt.folic_acid > 0::numeric then dn.total_folic_acid / nt.folic_acid * 100::numeric
    else 0::numeric
  end as folic_acid_percent,
  case
    when nt.calcium > 0::numeric then dn.total_calcium / nt.calcium * 100::numeric
    else 0::numeric
  end as calcium_percent,
  case
    when nt.vitamin_d > 0::numeric then dn.total_vitamin_d / nt.vitamin_d * 100::numeric
    else 0::numeric
  end as vitamin_d_percent
from
  daily_nutrients dn
  join profiles p on dn.user_id = p.user_id
  join nutrition_targets nt on calculate_trimester (p.due_date) = nt.trimester;

  create table public.nutrition_targets (
  id uuid not null default extensions.uuid_generate_v4 (),
  trimester integer not null,
  calories numeric null,
  protein numeric null,
  iron numeric null,
  folic_acid numeric null,
  calcium numeric null,
  vitamin_d numeric null,
  created_at timestamp with time zone null default now(),
  constraint nutrition_targets_pkey primary key (id),
  constraint nutrition_targets_trimester_key unique (trimester)
) TABLESPACE pg_default;

create table public.profiles (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  age integer null,
  height numeric null,
  weight numeric null,
  due_date date null,
  dietary_restrictions text[] null,
  adult_family_members integer null,
  child_family_members integer null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_profiles_user_id on public.profiles using btree (user_id) TABLESPACE pg_default;

create table public.profiles_backup (
  id uuid null,
  user_id uuid null,
  age integer null,
  pregnancy_week integer null,
  trimester integer null,
  height numeric null,
  weight numeric null,
  due_date date null,
  dietary_restrictions text[] null,
  adult_family_members integer null,
  child_family_members integer null,
  auto_update_week boolean null,
  created_at timestamp with time zone null,
  updated_at timestamp with time zone null
) TABLESPACE pg_default;

create table public.weight_logs (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  log_date date not null,
  weight numeric not null,
  comment text null,
  created_at timestamp with time zone null default now(),
  constraint weight_logs_pkey primary key (id),
  constraint weight_logs_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_weight_logs_user_date on public.weight_logs using btree (user_id, log_date) TABLESPACE pg_default;
