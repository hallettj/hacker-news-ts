/*
 * This is a demonstration of type checking with TypeScript. This example is
 * a Hacker News client.
 *
 * Take a look at the accompanying blog post:
 * TODO
 *
 * The full code for this project is here:
 * https://github.com/hallettj/typescript-hacker-news
 */
import * as t from "io-ts";
import { reporter } from "io-ts-reporters";
import fetch from "node-fetch";

/* types and validators */

// Type and validator for IDs. This is just an alias for the `number` type.
const ID_V = t.number;
export type ID = t.TypeOf<typeof ID_V>;

// Type and validator for properties common to all Hacker News item types
const ItemCommonV = t.type(
  {
    by: t.string, // username
    id: ID_V,
    time: t.number, // seconds since Unix epoch
    dead: optional(t.boolean),
    deleted: optional(t.boolean),
    kids: optional(t.array(ID_V)) // IDs of comments on an item
  },
  "ItemCommon"
);

// Type and validator for properties common to stories, job postings, and polls
const TopLevelV = t.type(
  {
    score: t.number,
    title: t.string
  },
  "TopLevel"
);

const StoryV = t.intersection(
  [
    t.type({
      type: t.literal("story"),
      descendants: t.number, // number of comments
      text: optional(t.string), // HTML content if story is a text post
      url: optional(t.string) // URL of linked article if the story is not text post
    }),
    ItemCommonV,
    TopLevelV
  ],
  "Story"
);
export type Story = t.TypeOf<typeof StoryV>;

const JobV = t.intersection(
  [
    t.type({
      type: t.literal("job"),
      text: optional(t.string), // HTML content if job is a text post
      url: optional(t.string) // URL of linked page if the job is not text post
    }),
    ItemCommonV,
    TopLevelV
  ],
  "Job"
);
export type Job = t.TypeOf<typeof JobV>;

const PollV = t.intersection(
  [
    t.type({
      type: t.literal("poll"),
      descendants: t.number, // number of comments
      parts: t.array(ID_V)
    }),
    ItemCommonV,
    TopLevelV
  ],
  "Poll"
);
export type Poll = t.TypeOf<typeof PollV>;

const CommentV = t.intersection(
  [
    t.type({
      type: t.literal("comment"),
      parent: ID_V,
      text: t.string // HTML content
    }),
    ItemCommonV
  ],
  "Comment"
);
export type Comment = t.TypeOf<typeof CommentV>;

const PollOptV = t.intersection(
  [
    t.type({
      type: t.literal("pollopt"),
      poll: ID_V, // ID of poll that includes this option
      score: t.number,
      text: t.string // HTML content
    })
  ],
  "PollOpt"
);
export type PollOpt = t.TypeOf<typeof PollOptV>;

const ItemV = t.taggedUnion(
  "type", // the name of the tag property
  [CommentV, JobV, PollV, PollOptV, StoryV],
  "Item"
);
type Item = t.TypeOf<typeof ItemV>;

/* functions to fetch and display stories and other items */

export async function fetchItem(id: ID): Promise<Item> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  );
  const obj = await res.json();
  return decodeToPromise(ItemV, obj);
}

async function fetchItemType<T>(validator: t.Type<T>, id: ID): Promise<T> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  );
  const obj = await res.json();
  return decodeToPromise(validator, obj);
}

function getTitle(item: Item): string | undefined {
  if (item.type === "story") {
    // This works because this line is only reachable if the type of
    // `item.type` is `'story'`, which means that `item` can be expected to
    // have a `title` property.
    return item.title;
  }
}

function formatStory(story: Story): string {
  return `"${story.title}" submitted by ${story.by}`;
}

function formatItem(item: Item): string {
  switch (item.type) {
    case "story":
      return `"${item.title}" submitted by ${item.by}`;
    case "job":
      return `job posting: ${item.title}`;
    case "poll":
      const numOpts = item.parts.length;
      return `poll: "${item.title}" - choose one of ${numOpts} options`;
    case "pollopt":
      return `poll option: ${item.text}`;
    case "comment":
      const excerpt =
        item.text.length > 60 ? item.text.slice(0, 60) + "..." : item.text;
      return `${item.by} commented: ${excerpt}`;
  }
}

// Fetch up to 500 of the top stories, jobs, or polls
export async function fetchTopStories(count: number): Promise<Item[]> {
  const res = await fetch(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );
  const ids = await decodeToPromise(t.array(ID_V), await res.json());
  return Promise.all(ids.slice(0, count).map(id => fetchItem(id)));
}

function getTitleCowboyStyle(item: Item): string | undefined {
  switch (item.type) {
    case "story":
    case "job":
    case "poll":
      return item.title;
  }
}

/* a very basic client */

export async function main() {
  try {
    const stories = await fetchTopStories(15);
    for (const story of stories) {
      console.log(formatItem(story) + "\n");
    }
  } catch (err) {
    console.error(err.message);
  }
}
if (require.main === module) {
  main();
}

/* utility functions */

function optional<RT extends t.Any>(
  type: RT,
  name: string = `?${type.name}`
): t.UnionType<
  [RT, t.UndefinedType],
  t.TypeOf<RT> | undefined,
  t.OutputOf<RT> | undefined,
  t.InputOf<RT> | undefined
> {
  return t.union<[RT, t.UndefinedType]>([type, t.undefined], name);
}

function decodeToPromise<T, O, I>(
  validator: t.Type<T, O, I>,
  input: I
): Promise<T> {
  const result = validator.decode(input);
  return result.fold(
    errors => {
      const messages = reporter(result);
      return Promise.reject(new Error(messages.join("\n")));
    },
    value => Promise.resolve(value)
  );
}

async function fetchTitle(storyId: number): Promise<string> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`
  );
  const data = await res.json();

  // If the data that is fetched does not match the `StoryV` validator then this
  // line will result in a rejected promise.
  const story = await decodeToPromise(StoryV, data);

  // This line does not type-check because TypeScript can infer from the
  // definition of `StoryV` that `story` does not have a property called
  // `descendents`.
  // const ds = story.descendents;

  // TypeScript infers that `story` does have a `title` property with a value of
  // type `string`, so this passes type-checking.
  return story.title;
}
