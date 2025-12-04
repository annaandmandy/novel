-- Create profiles table
create table if not exists profiles (
  id text primary key,
  username text,
  bio text,
  tags text[],
  preferences jsonb default '{"fontSize": 18, "fontFamily": "font-serif", "theme": "dark"}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Insert the default user
insert into profiles (id, username)
values ('productive_v1', 'Productive User')
on conflict (id) do nothing;

-- Create novels table
create table if not exists novels (
  id uuid default gen_random_uuid() primary key,
  owner_id text references profiles(id) not null,
  title text not null,
  genre text not null, -- 'BG' or 'BL'
  summary text, -- The 150+ word summary
  settings jsonb, -- { protagonist, loveInterest, trope }
  is_public boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create chapters table
create table if not exists chapters (
  id uuid default gen_random_uuid() primary key,
  novel_id uuid references novels(id) on delete cascade not null,
  chapter_index integer not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create characters table
create table if not exists characters (
  id uuid default gen_random_uuid() primary key,
  novel_id uuid references novels(id) on delete cascade not null,
  name text not null,
  role text, -- Protagonist, Antagonist, Supporting
  gender text, -- Male, Female, Other
  status text default 'Alive', -- Alive, Dead, Missing
  attributes jsonb default '{}', -- { identity: "...", ability: "..." }
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create memories table (for RAG and summaries)
create table if not exists memories (
  id uuid default gen_random_uuid() primary key,
  novel_id uuid references novels(id) on delete cascade not null,
  content text not null,
  type text default 'event', -- 'summary', 'event', 'fact'
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table novels enable row level security;
alter table chapters enable row level security;
alter table characters enable row level security;
alter table memories enable row level security;
alter table profiles enable row level security;

-- Policies (Simplified for demo: Allow everything for productive_v1)
create policy "Allow all for productive_v1 novels" on novels for all using (owner_id = 'productive_v1');
create policy "Allow all for productive_v1 chapters" on chapters for all using (true);
create policy "Allow all for productive_v1 characters" on characters for all using (true);
create policy "Allow all for productive_v1 memories" on memories for all using (true);
create policy "Allow all for productive_v1 profiles" on profiles for all using (id = 'productive_v1');

-- Create reading_progress table
create table if not exists reading_progress (
  id uuid default gen_random_uuid() primary key,
  user_id text references profiles(id) not null,
  novel_id uuid references novels(id) on delete cascade not null,
  last_chapter_index integer default 1,
  last_page_index integer default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, novel_id)
);

-- Enable RLS
alter table reading_progress enable row level security;

-- Policies
create policy "Allow all for productive_v1 progress" on reading_progress for all using (user_id = 'productive_v1');

-- Add target_ending_chapter to novels table
alter table novels add column if not exists target_ending_chapter integer;

-- Add tags to novels table
alter table novels add column if not exists tags text[];

-- Add profile to characters table (for deep character settings)
alter table characters add column if not exists profile jsonb default '{}';
-- Create favorites table
create table if not exists favorites (
  id uuid default gen_random_uuid() primary key,
  user_id text references profiles(id) not null,
  novel_id uuid references novels(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, novel_id)
);

-- Enable RLS for favorites
alter table favorites enable row level security;

-- Policies for favorites
create policy "Users can manage their own favorites" on favorites for all using (auth.uid()::text = user_id);
create policy "Users can view their own favorites" on favorites for select using (auth.uid()::text = user_id);
-- Add gender to characters table
alter table characters add column if not exists gender text;
