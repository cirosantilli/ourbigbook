import React from 'react'

import Comment from 'front/Comment'
import CommentInput from 'front/CommentInput'
import { CommentType } from 'front/types/CommentType'
import ArticleList from 'front/ArticleList'
import routes from 'front/routes'

// This also worked. But using the packaged one reduces the need to replicate
// or factor out the webpack setup of the ourbigbook package.
//import { ourbigbook_runtime } from 'ourbigbook/ourbigbook_runtime.js';
import { ourbigbook_runtime } from 'ourbigbook/dist/ourbigbook_runtime.js'

function renderRefCallback(elem) {
  if (elem) {
    ourbigbook_runtime(elem);
  }
}

const Article = ({
  article,
  comments,
  commentsCount,
  isIssue,
  issues,
  issuesCount,
  loggedInUser,
}) => {
  const [curComments, setComments] = React.useState(comments)
  let seeAllCreateNew
  if (!isIssue) {
    seeAllCreateNew = <>
      {issues.length > 0 &&
        <>
          <a href={routes.issuesLatest(article.slug)}><i className="ion-eye" /> See all { issuesCount } threads</a>
          {' '}
        </>
      }
      <a href={routes.issueNew(article.slug)}><i className="ion-edit" /> Create a new thread</a>
    </>
  }
  return <>
    <div
      dangerouslySetInnerHTML={{ __html: article.render }}
      className="ourbigbook"
      ref={renderRefCallback}
    />
    <div className="comments content-not-ourbigbook">
      {isIssue
        ? <>
            <h2>Comments ({ commentsCount })</h2>
            <div className="comment-form-holder">
              <CommentInput {...{ comments, setComments, loggedInUser }}/>
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
            <h2>Discussion ({ issuesCount })</h2>
            { seeAllCreateNew }
            { issues.length > 0 ?
                <>
                  <h3>Latest threads</h3>
                  <ArticleList {...{
                    articles: issues,
                    articlesCount: issuesCount,
                    comments,
                    commentsCount,
                    issueArticle: article,
                    isIssue: true,
                    loggedInUser,
                    page: 0,
                    showAuthor: true,
                    what: 'issues',
                  }}/>
                  { seeAllCreateNew }
                </>
              : <p>There are no discussion threads in this article yet.</p>
            }
          </>
      }
    </div>
  </>
}
export default Article
