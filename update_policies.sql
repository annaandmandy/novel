-- Drop existing insecure policies
drop policy if exists "Allow all for productive_v1 novels" on novels;
drop policy if exists "Allow all for productive_v1 chapters" on chapters;
drop policy if exists "Allow all for productive_v1 characters" on characters;
drop policy if exists "Allow all for productive_v1 memories" on memories;
drop policy if exists "Allow all for productive_v1 profiles" on profiles;
drop policy if exists "Allow all for productive_v1 progress" on reading_progress;

-- Novels Policies
create policy "Users can view own novels" on novels for select using (auth.uid()::text = owner_id);
create policy "Users can view public novels" on novels for select using (is_public = true);
create policy "Users can insert own novels" on novels for insert with check (auth.uid()::text = owner_id);
create policy "Users can update own novels" on novels for update using (auth.uid()::text = owner_id);
create policy "Users can delete own novels" on novels for delete using (auth.uid()::text = owner_id);

-- Chapters Policies
create policy "Users can view chapters of own novels" on chapters for select using (
  exists (select 1 from novels where novels.id = chapters.novel_id and novels.owner_id = auth.uid()::text)
);
create policy "Users can view chapters of public novels" on chapters for select using (
  exists (select 1 from novels where novels.id = chapters.novel_id and novels.is_public = true)
);
create policy "Users can manage chapters of own novels" on chapters for all using (
  exists (select 1 from novels where novels.id = chapters.novel_id and novels.owner_id = auth.uid()::text)
);

-- Characters Policies
create policy "Users can view characters of own novels" on characters for select using (
  exists (select 1 from novels where novels.id = characters.novel_id and novels.owner_id = auth.uid()::text)
);
create policy "Users can view characters of public novels" on characters for select using (
  exists (select 1 from novels where novels.id = characters.novel_id and novels.is_public = true)
);
create policy "Users can manage characters of own novels" on characters for all using (
  exists (select 1 from novels where novels.id = characters.novel_id and novels.owner_id = auth.uid()::text)
);

-- Memories Policies
create policy "Users can view memories of own novels" on memories for select using (
  exists (select 1 from novels where novels.id = memories.novel_id and novels.owner_id = auth.uid()::text)
);
create policy "Users can view memories of public novels" on memories for select using (
  exists (select 1 from novels where novels.id = memories.novel_id and novels.is_public = true)
);
create policy "Users can manage memories of own novels" on memories for all using (
  exists (select 1 from novels where novels.id = memories.novel_id and novels.owner_id = auth.uid()::text)
);

-- Profiles Policies
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid()::text = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid()::text = id);

-- Reading Progress Policies
create policy "Users can manage own reading progress" on reading_progress for all using (auth.uid()::text = user_id);
