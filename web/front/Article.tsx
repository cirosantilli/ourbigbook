import React from 'react'
import * as ReactDOM from 'react-dom'

import { formatDate } from 'front/date'
import { IssueIcon, EditArticleIcon, NewArticleIcon, SeeIcon, SignupOrLogin, TimeIcon, TopicIcon } from 'front'
import Comment from 'front/Comment'
import CommentInput from 'front/CommentInput'
import LikeArticleButton from 'front/LikeArticleButton'
import { CommentType } from 'front/types/CommentType'
import ArticleList from 'front/ArticleList'
import routes from 'front/routes'
import { cant } from 'front/cant'
import CustomLink from 'front/CustomLink'

import { AT_MENTION_CHAR, render_toc_from_entry_list } from 'ourbigbook'
// This also worked. But using the packaged one reduces the need to replicate
// or factor out the webpack setup of the ourbigbook package.
//import { ourbigbook_runtime } from 'ourbigbook/ourbigbook_runtime.js';
import { ourbigbook_runtime } from 'ourbigbook/dist/ourbigbook_runtime.js'

const Article = ({
  article,
  articlesInSamePage,
  comments,
  commentsCount=0,
  commentCountByLoggedInUser=undefined,
  isIssue=false,
  issueArticle=undefined,
  issuesCount,
  latestIssues,
  loggedInUser,
  topIssues,
}) => {
  const [curComments, setComments] = React.useState(comments)
  let seeAllCreateNew
  if (!isIssue) {
    seeAllCreateNew = <>
      {latestIssues.length > 0 &&
        <>
          <CustomLink href={routes.issues(article.slug)}><SeeIcon /> See all ({ issuesCount })</CustomLink>{' '}
        </>
      }
      {loggedInUser
        ? <CustomLink href={routes.issueNew(article.slug)}><NewArticleIcon /> New discussion</CustomLink>
        : <SignupOrLogin to="create discussions"/>
      }
    </>
  }
  const articlesInSamePageMap = {}
  if (!isIssue) {
    for (const article of articlesInSamePage) {
      articlesInSamePageMap[article.topicId] = article
    }
  }
  articlesInSamePageMap[article.topicId] = article
  const canEdit = isIssue ? !cant.editIssue(loggedInUser, article) : !cant.editArticle(loggedInUser, article)
  const renderRefCallback = React.useCallback(
    (elem) => {
      if (elem) {
        for (const h of elem.querySelectorAll('.h')) {
          const id = h.id
          const web = h.querySelector('.web')
          const toplevel = web.classList.contains('top')
          // TODO rename to article later on.
          let curArticle, isIndex
          if (isIssue) {
            if (!toplevel) {
              continue
            }
            curArticle = article
          } else if (
            // Happens on user index page.
            id === ''
          ) {
            curArticle = article
            isIndex = true
          } else {
            curArticle = articlesInSamePageMap[id]
            if (!curArticle) {
              // Possible for Include headers. Maybe one day we will cover them.
              continue
            }
          }
          let mySlug
          if (loggedInUser) {
            mySlug = `${loggedInUser.username}/${curArticle.topicId}`
          }
          ReactDOM.render(
            <>
              <LikeArticleButton {...{
                article: curArticle,
                loggedInUser,
                isIssue: false,
                showText: toplevel,
              }} />
              {!isIssue &&
                <>
                  {' '}
                  {!isIndex &&
                    <a className="by-others btn" href={routes.topic(id)} title="Articles by others on the same topic">
                      <TopicIcon title={false} /> {curArticle.topicCount}{toplevel ? <> By Others<span className="mobile-hide"> On Same Topic</span></> : ''}
                    </a>
                  }
                  {' '}
                  <a className="issues btn" href={routes.issues(curArticle.slug)} title="Discussions">
                    <IssueIcon title={false} /> {isIndex ? issuesCount : curArticle.issueCount}{toplevel ? ' Discussions' : ''}</a>
                </>
              }
              {toplevel &&
                <>
                  {' '}
                  <span title="Last updated">
                    <TimeIcon />{' '}
                    <span className="article-dates">
                      {formatDate(article.updatedAt)}
                    </span>
                  </span>
                </>
              }
              {false && article.createdAt !== article.updatedAt &&
                <>
                  <span className="mobile-hide">
                    {' Updated: '}
                  </span>
                  <span className="article-dates">
                    {formatDate(article.updatedAt)}
                  </span>
                </>
              }
              {canEdit
                ?
                <>
                  {' '}
                  <span>
                    {false && <>TODO: convert this a and all other injected links to Link. https://github.com/cirosantilli/ourbigbook/issues/274</> }
                    <a
                      href={isIssue ? routes.issueEdit(issueArticle.slug, curArticle.number) : routes.articleEdit(curArticle.slug)}
                      className="btn edit"
                    >
                      <EditArticleIcon />{toplevel && <> <span className="shortcut">E</span>dit</>}
                    </a>
                  </span>
                </>
                :
                <>
                  {!isIssue &&
                    <>
                      {(curArticle.hasSameTopic || isIndex)
                        ? <>
                            {article.slug !== mySlug &&
                              <>
                                {' '}
                                <a href={routes.article(mySlug)} className="btn see" title="See my version of this topic">
                                    {' '}<SeeIcon title={false}/>{toplevel ? ' See My Version' : ''}{' '}
                                </a>
                              </>
                            }
                          </>
                        : <>
                            {' '}
                            <a href={routes.articleNew({ title: curArticle.titleSource })} className="btn new" title="Create my version of this topic">
                              {' '}<NewArticleIcon title={false}/>{toplevel ? ' Create my own version' : ''}{' '}
                            </a>
                          </>
                      }
                    </>
                  }
                </>
              }
            </>,
            web
          );
        }
        ourbigbook_runtime(elem);
        // Capture link clicks, use ID on current page if one is present.
        // Only go to another page if the ID is not already present on the page.
        for (const a of elem.getElementsByTagName('a')) {
          a.addEventListener(`click`, e => {
            // + 4 for the '../' and trailing `/`
            const idNoprefix = e.target.getAttribute('href').slice(article.author.username.length + 4)
            const targetElem = document.getElementById(idNoprefix)
            if (targetElem) {
              console.error({idNoprefix});
              e.preventDefault()
              window.location.hash = idNoprefix
            }
          });
        }
      }
    },
    []
  );
  let html = ''
  if (!isIssue) {
     html += article.h1Render
  }
  html += article.render
  if (!isIssue) {
    // A mega hacky version. Would it significantly improve rendering time?
    //const tocHtml = articlesInSamePage.slice(1).map(a => `<div style="padding-left:${30 * (a.depth - firstArticle.depth)}px;"><a href="../${article.author.username}/${a.topicId}">${a.titleRender}</a></div>`).join('') +
    const entry_list = []
    const levelToHeader = { 0: article }
    for (let i = 0; i < articlesInSamePage.length; i++) {
      const a = articlesInSamePage[i]
      const authorUsername = article.author.username
      const level = a.depth - article.depth
      const href = ` href="../${authorUsername}/${a.topicId}"`
      const content = a.titleRender
      let parent_href, parent_content
      if (level > 1) {
        ;({ href: parent_href, content: parent_content } = levelToHeader[level - 1])
      }
      levelToHeader[level] = { href, content }
      entry_list.push({
        content,
        href,
        level,
        has_child: i < articlesInSamePage.length - 1 && articlesInSamePage[i + 1].depth === a.depth + 1,
        // A quick hack as it will be easier to do it here than to modify the link generation.
        // We'll later fix both at once to remove the user prefix one day. Maybe.
        // https://docs.ourbigbook.com/TODO/remove-scope-from-toc-entry-ids
        id_prefix: AT_MENTION_CHAR + authorUsername + '/',
        parent_href,
        parent_content,
        target_id: a.topicId,
      })
    }
    if (entry_list.length) {
      html += render_toc_from_entry_list({ entry_list })
    }
    html += articlesInSamePage.map(a => a.h2Render + a.render).join('')
  }
  return <>
    <div
      dangerouslySetInnerHTML={{
        __html: html
      }}
      className="ourbigbook"
      ref={renderRefCallback}
    />
    <div className="comments content-not-ourbigbook">
      {isIssue
        ? <>
            <h2><IssueIcon /> Comments ({ commentsCount })</h2>
            <div className="comment-form-holder">
              <CommentInput {...{
                comments,
                commentCountByLoggedInUser,
                issueNumber: article.number,
                loggedInUser,
                setComments,
              }}/>
            </div>
            {curComments?.map((comment: CommentType) =>
              <Comment {...{
                comment,
                comments,
                id: comment.id,
                key: comment.id,
                loggedInUser,
                setComments,
              }} />
            )}
          </>
        : <>
            <h2><CustomLink href={routes.issues(article.slug)}><IssueIcon /> Discussion ({ issuesCount })</CustomLink></h2>
            { seeAllCreateNew }
            { latestIssues.length > 0 ?
                <>
                  <h3>Latest threads</h3>
                  <ArticleList {...{
                    articles: latestIssues,
                    articlesCount: issuesCount,
                    comments,
                    commentsCount,
                    issueArticle: article,
                    itemType: 'discussion',
                    loggedInUser,
                    page: 0,
                    showAuthor: true,
                    what: 'discussion',
                  }}/>
                  <h3>Top threads</h3>
                  <ArticleList {...{
                    articles: topIssues,
                    articlesCount: issuesCount,
                    comments,
                    commentsCount,
                    issueArticle: article,
                    itemType: 'discussion',
                    loggedInUser,
                    page: 0,
                    showAuthor: true,
                    what: 'issues',
                  }}/>
                  { seeAllCreateNew }
                </>
              : <p>There are no discussions about this article yet.</p>
            }
          </>
      }
    </div>
  </>
}
export default Article
