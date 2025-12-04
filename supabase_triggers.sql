-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, bio, tags, preferences)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', new.email), 
    '', 
    '{}', 
    '{"fontSize": 18, "fontFamily": "font-serif", "theme": "dark"}'::jsonb
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
