-- Users profile (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  grade int check (grade between 1 and 9),
  created_at timestamptz default now()
);

-- Storage bucket for syllabus images
insert into storage.buckets (id, name, public) values ('syllabuses', 'syllabuses', true);

-- Syllabuses (đề cương upload)
create table public.syllabuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  subject text not null,
  grade int not null check (grade between 1 and 9),
  image_urls text[] not null,
  extracted_content text,
  status text default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  created_at timestamptz default now()
);

-- Exam sets (bộ đề sinh ra)
create table public.exam_sets (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid references public.syllabuses(id) on delete cascade,
  title text not null,
  subject text not null,
  grade int not null,
  total_questions int default 0,
  created_at timestamptz default now()
);

-- Questions (câu hỏi)
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_set_id uuid references public.exam_sets(id) on delete cascade,
  order_number int not null,
  type text default 'multiple_choice' check (type in ('multiple_choice', 'true_false', 'short_answer')),
  question_text text not null,
  options jsonb,         -- [{key: 'A', text: '...'}, ...]
  correct_answer text not null,
  explanation text,
  difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard'))
);

-- Practice sessions (lịch sử làm bài)
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  exam_set_id uuid references public.exam_sets(id) on delete cascade,
  answers jsonb,         -- {question_id: answer, ...}
  score int,
  total int,
  completed_at timestamptz
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.syllabuses enable row level security;
alter table public.exam_sets enable row level security;
alter table public.questions enable row level security;
alter table public.practice_sessions enable row level security;

create policy "Users can manage own profile" on public.profiles for all using (auth.uid() = id);
create policy "Users can manage own syllabuses" on public.syllabuses for all using (auth.uid() = user_id);
create policy "Anyone can view exam sets" on public.exam_sets for select using (true);
create policy "Anyone can view questions" on public.questions for select using (true);
create policy "Users can manage own sessions" on public.practice_sessions for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
