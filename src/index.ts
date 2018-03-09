import * as t from 'io-ts'
import fetch from 'node-fetch'

type ID = string
const id = t.Integer

function optional<RT extends t.Any>(
  type: RT,
  name?: string
): t.UnionType<[RT, t.UndefinedType], t.TypeOf<RT> | undefined, t.OutputOf<RT> | undefined, t.InputOf<RT> | undefined> {
  return t.union<[RT, t.UndefinedType]>([type, t.undefined], name)
}

const ItemCommon = t.type({
  by: t.string,
  id: id,
  time: t.number,
  dead: optional(t.boolean),
  deleted: optional(t.boolean)
})

const TopLevel = t.type({
  descendents: t.number,
  score: t.number,
  title: t.string
})

const story = t.intersection([
  t.type({
    type: t.literal('story'),
    kids: optional(t.array(id)),
    url: t.string
  }),
  ItemCommon,
  TopLevel
])
type Story = t.TypeOf<typeof story>

const comment = t.intersection([
  t.type({
    type: t.literal('comment'),
    kids: optional(t.array(id)),
    parent: id,
    text: t.string
  }),
  ItemCommon
])
type Comment = t.TypeOf<typeof comment>

const Item = t.taggedUnion('type', [story, comment])
type ItemT = t.TypeOf<typeof item>

function test (input: string) {
  const item = Item.decode(input)

  switch (item.type) {
    case 'story':
      console.log(item.url)
      break
    case 'comment':
      console.log(item.text)
      break
  }
}
